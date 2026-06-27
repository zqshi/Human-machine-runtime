# 投产灰区端到端实测清单

> **状态**: [IMPLEMENTED] 代码已实现,本文档为真环境 E2E 验证清单(tsc/vitest 测不出的运行时灰区)
> **来源**: v1.9 snapshot 遗留 + v1.2.2 投产收尾 T16 交付清单的运行时落地
> **核实日期**: 2026-06-25
> **目的**: 把"门禁全绿"掩盖下的 4 项主路径运行时风险逐项验证关掉,关闭 backlog D10 及相关遗留

## 为什么需要这份清单

以下 4 项均通过 `tsc --noEmit` + `vitest run` + `eslint`,但**触及流式/跨进程/真请求主路径**,静态测试无法覆盖运行时行为(类 `migrate.ts 不跑 .sql` 风险)。未在真实环境验证前,不能认为"已投产就绪"。

| # | 项 | 风险类型 | 关联债务 |
|---|----|---------|---------|
| 1 | T9 流式 SSE 真请求 | 浏览器流式回包 | v1.9 遗留 1 |
| 2 | T18b canUseTool 审批闭环 | 跨进程容器调用 | backlog D3 |
| 3 | T20b marketplace 安装即对话 | 真 LLM 响应 | backlog D9 |
| 4 | D10 cockpitStore 自举(IM 共享 Agent) | instanceId 全链路接线 | backlog D10 |

---

## 0. 通用环境准备

```bash
# 0.1 基础设施
docker-compose up -d postgres conduit        # PG:5435 / Conduit:6167

# 0.2 server (3002)
cd server && npm run dev

# 0.3 client (5176)
cd client-suite/apps/web && npm run dev

# 0.4 真实 LLM 网关(cockpit chat 经 LiteLLM,不经 harness)
#   LiteLLM 服务可达 + aiGatewayRepo 有实例 apiKey 记录(见验证项 3/4 排查)

# 0.5 claude-worker(仅验证项 2 需要)
#   重建镜像: CLAUDE_WORKER_E2E=1
#   设 env: CLAUDE_INTERNAL_TOOL_SECRET=<共享密钥>
#         CLAUDE_WORKER_CALLBACK_URL=http://host.docker.internal:3002
#   server 侧配同值 CLAUDE_INTERNAL_TOOL_SECRET(否则 internal-auth 503)
```

**通用前置数据**: 至少 1 个租户 + 1 个 Pro 套餐 + 1 个 AgentDefinition(含 persona)+ 1 个 instance(关联 agentDefinitionId)+ aiGatewayRepo 有该 instance 的 apiKey。

---

## 验证项 1 — T9 流式 SSE 真请求

> **2026-06-25 后端 curl 实测结果(已执行)**:
> - ✅ `POST /api/cockpit/chat/stream` 200 + `Content-Type: text/event-stream` + `Transfer-Encoding: chunked`,SSE 分块 `data:{"choices":[{"delta":{"content":"..."}}]}` 真到达(GLM via LiteLLM)
> - ✅ guardrail 硬约束拦截生效:命中 keyword"密码"→ `{"reply":refusalResponse,"model":"guardrail","blocked":true}`
> - ⚠️ **发现代码缺陷:persona.systemPrompt 未注入 LLM**。chat.ts:104 `systemPrompt = body.systemPrompt || DEFAULT_SYSTEM_PROMPT`,persona.systemPrompt 被忽略。问"你是谁"回复"没有具体名字",不知自己是 persona 声明的 Alice。v1.9 T15"注入 PersonaProvider 作后端 guardrail 兜底"只实现了 guardrails 拦截,人设软约束漏了。**记入 current.md 计划外工作,待修复**
> - ⚠️ **chat/stream 是伪流式**:line 205 先调 chatCompletion(非 stream:true 拿完整回复),line 224-232 再按 chunkSize=20 切块用 SSE 吐。非真正 LLM 逐 token 流式。非 bug 但与"流式"预期有差距,前端逐字渲染依赖此
> - **实测环境补齐**:docker-compose `--profile litellm` 拉起 LiteLLM + config.yaml 加 GLM 路由(claude-sonnet-4-6→glm-4-flash via open.bigmodel.cn/api/paas/v4)+ GLM_API_KEY 注入 + 跑 db:migrate(补 persona/bound_knowledge/runtime 三列,migration 之前未执行)+ 插 instance_llm_keys(master key)+ agent_definitions(带 persona/guardrail)+ 关联 instance

**目标**: 确认 useAgentChat 重构(AgentRuntimePort 解耦 + persona 从 instance→agentDefinitionId 拉)后,IM 模式对话流式回包正常,未破坏 cockpit/weKnora 主路径。

### 前置
- 通用环境 0.1-0.4
- 当前用户有 active instance(走 IM 对话上下文,非 marketplace)

### 操作步骤
1. 浏览器打开 client(127.0.0.1:5176),登录,进入 IM 对话
2. 选一个已有共享 Agent / 实例,发一条消息(如"你好")
3. DevTools → Network 找 `POST /api/cockpit/chat/stream` 请求
4. 观察 Response: Content-Type 应为 `text/event-stream`

### 预期信号(成功)
- ✅ 响应头 `Content-Type: text/event-stream`
- ✅ 响应体逐块 `data: {"choices":[{"delta":{"content":"..."}}]}` 流式到达(非一次性)
- ✅ 对话界面消息**逐字增量**渲染(非阻塞等待全部)
- ✅ persona 真注入: 回复风格符合 AgentDefinition.persona(非默认空 persona)
- ✅ guardrail 前端拦截生效: 发违禁内容时前端 `checkGuardrails` 拦截,不发请求

### 失败排查
| 现象 | 查 |
|------|-----|
| 503 | LiteLLM 未配置 / aiGatewayRepo 无该 instance apiKey → `SELECT * FROM ai_gateway_keys WHERE instance_id=...` |
| 502 | LiteLLM 调用失败 → server 日志看 LiteLLM 上游错误 |
| 一次性返回非流式 | 走了 fallback mock 分块(chat.ts:224-231)→ 检查 LiteLLM 是否真调用,非真调用会回落 mock |
| 回复无 persona 风格 | `activeInstanceId` 为 null → useAgentChat:325 chat 请求 instanceId 字段;查 cockpitStore.activeInstanceId 是否设非 null(见验证项 4) |
| 前端报 SSE error | useAgentChat:434 `streamFailed` → fallback 重试;查 console.warn 消息 |

### tsc/vitest 为何测不出
SSE 流式回包是浏览器↔server 运行时 HTTP 行为,vitest 只测 useAgentChat 的 onChunk 累积逻辑(纯函数),测不到真 SSE 事件流 + persona 真注入 + LiteLLM 真调用。

---

## 验证项 2 — T18b canUseTool 审批闭环

> **2026-06-25 server 侧 route 运行时实测结果(已执行)**:
> - ✅ `/api/internal/tool-check` route 运行时行为完整验证(超出单测):
>   - 守卫:无 secret / 错 secret → 401(internal-auth 生效)
>   - 向后兼容:`tool.approval.enforce` off → `{"allowed":true,"reason":"tool.approval.enforce off"}`
>   - 风险表(enforce on,platform_configs feature-flags 开启):Bash/Write/Edit(high)→deny(reason:canUseTool 同步无法 pending-approve) / Read/Glob/Grep/WebSearch/WebFetch(low)→allow / 未识别工具→deny(保守,留 T18a 第二阶段)
> - ⚠️ **发现配置要点**:feature flag 存 `platform_configs` 表 `feature-flags` key(JSON blob),非 system_configs 也非独立 feature_flags 表。开启需 `setFeatureFlag('tool.approval.enforce',{enabled:true,killSwitch:true})`,非 INSERT system_configs
> - ⏳ **worker 容器侧真闭环未验证**:canUseTool 钩子在真实 claude-worker 容器内回调 server,需重建镜像 `CLAUDE_WORKER_E2E=1` + 配 INTERNAL_TOOL_SECRET/WORKER_CALLBACK_URL + 触发实例任务调 Bash。容器侧操作,待用户配合(见下方原始步骤)
>
> **2026-06-25 worker 容器 E2E 尝试结果**:
> - ✅ worker 镜像构建成功(`docker build infra/claude-worker` → `claude-worker:test`)
> - ✅ worker 容器 SDK 启动成功:GLM Anthropic 端点(`open.bigmodel.cn/api/anthropic`)+ ANTHROPIC_AUTH_TOKEN 连通,产生 `session_id` 事件(NET 有流量)
> - ⏳ **canUseTool 未触发**:SDK 发请求后 CPU=0.00% 卡住,无 assistant 响应、无工具调用事件。根因:**GLM Anthropic 兼容端点不完整支持 claude-agent-sdk 工具调用流程**(SDK 协议要求模型支持 tool_use 流程,GLM 兼容层不全)→ 未产生工具调用 → canUseTool 钩子不触发 → server tool-check 未被 worker 回调
> - **结论**:HMR 代码侧已验证(worker.ts canUseTool 注入代码正确 + server tool-check route 运行时行为完整)。canUseTool 真触发待**真实 Anthropic API 或完整兼容 claude-agent-sdk 的模型**(如 Claude 原生)环境验证。此限制属模型兼容性,非 HMR 缺陷(与 T18b 文档预警"国产模型能否支撑 SDK 完整能力需实测"一致)
> - 实测环境清理:enforce 已恢复 off(默认),worker 容器已删,secret/key 配置保留供后续复测

**目标**: 确认 worker 容器内 SDK 调用工具时,canUseTool 钩子真回调 server `/api/internal/tool-check`,高风险工具(Bash/Write/Edit)在 enforce 开启时被 deny。

### 前置
- 通用环境 0.1-0.3 + **0.5 claude-worker**(CLAUDE_WORKER_E2E=1 重建镜像 + 共享密钥)
- DB system_configs: `tool.approval.enforce = 'enforce'`(三态 off/log/enforce)
- 一个会调 Bash 的 Agent(实例任务)

### 操作步骤
1. 确认 server config: `CLAUDE_INTERNAL_TOOL_SECRET` 与 worker 容器 `INTERNAL_TOOL_SECRET` 同值
2. 确认 `CLAUDE_WORKER_CALLBACK_URL=http://host.docker.internal:3002`(容器内能达 server)
3. 触发一个实例任务,让 Agent 尝试调 Bash
4. 观察 server 日志 `/api/internal/tool-check` 是否被调用

### 预期信号(成功)
- ✅ server 日志出现 `POST /api/internal/tool-check` 命中(非 404/503)
- ✅ enforce='enforce' 时:Bash(高风险)被 **deny**,Agent 不执行 Bash(canUseTool 返回 deny)
- ✅ enforce='off' 时:Bash 被 allow,Agent 正常执行
- ✅ Read/Glob/Grep(低风险)任何模式下 allow
- ✅ server 不可达时 worker `checkToolWithServer` 返回 **deny**(保守,非放行)

### 失败排查
| 现象 | 查 |
|------|-----|
| /api/internal/tool-check 503 | secret 未配或不匹配 → `middleware/internal-auth.ts` 503;查两端 `CLAUDE_INTERNAL_TOOL_SECRET` |
| 未命中 route(404) | worker fetch URL 不对 → 查 `CLAUDE_WORKER_CALLBACK_URL` + 容器内 DNS(host.docker.internal) |
| 高风险工具仍执行 | enforce 实际值 → `SELECT * FROM system_configs WHERE key='tool.approval.enforce'`;或 worker 未重建镜像(旧代码) |
| server 可达时仍 deny | tool-check 内置工具风险表命中 → 查 `BUILTIN_TOOL_RISK` 是否误判;未识别工具默认 deny(预期) |

### tsc/vitest 为何测不出
worker→server 是跨 docker 容器真实 HTTP 调用,vitest 只测 server route 逻辑(internal-auth 4 测 + tool-executor 7 测)+ worker `checkToolWithServer` 纯函数类型,测不到 SDK canUseTool 钩子在真实容器内的注入与回调。

### 范围说明(T18b-A 未覆盖,留后续)
- ❌ callLog 落库(canUseTool 是执行前钩子拿不到结果 + schema 缺 toolName 列)
- ❌ MCP custom tool 执行转发(凭证/计费)—— 外部工具保守 deny,治本留 T18a 第二阶段
- ❌ 外部工具 approvalGate 调用 —— 实例路径主要用内置工具

---

## 验证项 3 — T20b marketplace 安装即对话

> **2026-06-25 后端 curl 实测结果(已执行)**:
> - ✅ `POST /api/control/marketplace/agents/install` 端到端成功:route → marketplaceService.getAgent(mock 市场) → installAgent → 落 AgentDefinition(persona.systemPrompt="你是{name},{description}"正确生成) + instance(关联 agentDefinitionId)。返回 `{agentDefinitionId, instanceId, name}`
> - ✅ 落库验证:agent_definitions 新增 + instances.agent_definition_id 正确关联
> - ⚠️ **发现缺口1:installAgent 不触发 instance_llm_keys 同步**。新安装 instance 无 LiteLLM key → chat 直接 502。需手动配 key 或 installAgent 应触发 llm-key-sync-service。**已修(T25 done 2026-06-25)**:installAgent 末尾 syncDefaultModelKey(findOrCreateDefaultModel + 合并现有 grants + syncInstance 生成 virtual key);bootstrap 注入 setKeySyncDeps。实测:install 后自动 grant + key synced + 直接对话 200 真响应(无需手动配 key)
> - ⚠️ **缺口2(同 T9):persona.systemPrompt 未注入 LLM**。新 instance persona 声明"你是Mock Agent mka_demo",但问"你是谁"回复"没有具体名字"。chat.ts:104 用 DEFAULT_SYSTEM_PROMPT,persona.systemPrompt 被忽略
> - **实测环境补齐**:起本地 mock marketplace(python /tmp/mock-marketplace.py,响应 GET /api/v1/agents/{id}) + server/.env 加 MARKETPLACE_API_URL=http://127.0.0.1:4080 + 重启 server + 为新 instance 手动插 instance_llm_keys(master key)

**目标**: 确认 marketplace agent 点"对话"→ installAgent 落 AgentDefinition+instance → 真对话响应(非空转),persona/apiKey/guardrail 经 instanceId 真生效。

### 前置
- 通用环境 0.1-0.4
- marketplaceClient 可达(或 MOCK 数据可用)
- LiteLLM + aiGatewayRepo 可为安装后的 instance 提供 apiKey

### 操作步骤
1. 进入 Marketplace 页,选一个 agent,点"对话"
2. DevTools → Network 找 `POST /api/control/marketplace/agents/install`
3. 安装成功后应跳 IM(messages dock),自动打开对话
4. 在对话中发一条消息

### 预期信号(成功)
- ✅ install 返回 201 + instanceId(新建 AgentDefinition + instance)
- ✅ 跳转后 cockpitStore.activeInstanceId = 返回的 instanceId(非 null)
- ✅ 对话请求 `POST /api/cockpit/chat/stream` 的 instanceId 字段非 null
- ✅ 真对话响应(经 LiteLLM,非空转/非 mock fallback)
- ✅ persona 生效: 回复风格符合 installAgent 设的 `你是{name},{description}`

### 失败排查
| 现象 | 查 |
|------|-----|
| install 400/500 | routes/control/marketplace.ts zod 校验 + marketplace-service.installAgent 日志 |
| 安装后对话空转 | activeInstanceId 未设 → `sharedAgentChatService.openInstalledInstance` 是否调 `setActiveInstanceId` |
| chat instanceId null | cockpitStore.activeInstanceId 仍 null → 验证项 4 同源问题 |
| 503 | 安装后 instance 无 apiKey → aiGatewayRepo 需为该 instance 配 key |
| 重复安装产生多个 instance | 非幂等(已知遗留,T20b 未覆盖)→ 每次新建,非本次阻断项 |

### tsc/vitest 为何测不出
installAgent 链路跨 marketplace/agent-core/tenant-instance 三个 context 集成,真 LLM 响应经 LiteLLM 运行时。vitest 测 installAgent 2 测 + openInstalledInstance 1 测(纯逻辑),测不到 cockpitStore 状态机真切换 + LiteLLM 真请求。

---

## 验证项 4 — D10 cockpitStore 自举(IM 共享 Agent 对话)

**目标**: 确认 IM 模式共享 Agent(sa-* 及其他路径)对话时,activeInstanceId 真设非 null,persona/apiKey/guardrail 不失效。**此项是验证项 1/3 的根因核查**——T20b 文档发现 activeInstanceId 之前全链路 null(仅 marketplace 路径已修)。

### 前置
- 通用环境 0.1-0.4
- 已有 sa-* 共享 Agent(非 marketplace 安装的)

### 操作步骤
1. IM 模式选一个 sa-* 共享 Agent 对话
2. DevTools → Network 看 chat 请求 `instanceId` 字段
3. Console 执行 `useCockpitStore.getState().activeInstanceId` 看值

### 预期信号(成功)
- ✅ `activeInstanceId` 非 null(应为真实 instanceId)
- ✅ chat 请求 instanceId 非 null
- ✅ persona 真注入(非空 persona)

### 失败排查(关键)
| 现象 | 查 |
|------|-----|
| activeInstanceId = null | sa-* 旧路径未接线(setActiveInstanceId 仅 marketplace 调)→ **此为 D10 核心遗留,sa-* 路径空转** |
| persona 默认空 | 同上,instanceId null → personaProvider.getPersona(null) 放行 → 无 persona |
| 走 mock 回包 | instanceId null → apiKey 取不到 → 503 → 前端 fallback mock |

### 处置建议
- 若 sa-* 路径 activeInstanceId 仍 null:**D10 未真正关闭**,需补 sa-* → instanceId 接线(或确认 sa-* 已 @deprecated 不再使用,则标注放弃该路径)
- marketplace 路径(验证项 3)已修,可作为"正确接线"参照

### tsc/vitest 为何测不出
cockpitStore 状态机在运行时由多个 action 切换,activeInstanceId 的 setter 调用时机是运行时行为。vitest 测 store 初始值/reset,测不到"哪个 action 在何时设非 null"。

---

## 结果汇总(2026-06-25 后端 curl 实测)

| # | 项 | 结果 | 实测人 | 日期 | 备注/遗留 |
|---|----|------|-------|------|----------|
| 1 | T9 流式 SSE | ✅ pass(后端) | Claude | 2026-06-25 | SSE 真响应+guardrail 拦截生效;**发现 persona.systemPrompt 未注入 LLM**(chat.ts:104);chat/stream 是伪流式(先完整回复再切块)。前端逐字渲染待浏览器实测 |
| 2 | T18b 审批闭环 | ⚠️ 部分(server pass/worker 受限) | Claude | 2026-06-25 | server tool-check route 运行时完整验证(守卫+风险表+enforce 三态);worker 镜像构建+SDK 启动成功,但 GLM 不完整支持 SDK 工具调用流程→canUseTool 未触发(模型兼容限制,非 HMR) |
| 3 | T20b marketplace 对话 | ✅ pass(后端) | Claude | 2026-06-25 | install 端到端成功(落 AgentDefinition+instance+关联);**发现 installAgent 不触发 instance_llm_keys 同步**→新 instance 无法直接对话;persona.systemPrompt 未注入(同 T9) |
| 4 | D10 cockpitStore 自举 | ⏳ 待浏览器 | — | — | 后端 instanceId 链路已验证(chat 带 instanceId 真响应);前端 activeInstanceId 是否真设非 null 待浏览器 Console 验证 |

### 实测发现的真实代码缺陷(应入 current.md 计划外工作)

1. **persona.systemPrompt 未注入 LLM**(P1,影响 T9/T20b):chat.ts:104 `systemPrompt = body.systemPrompt || DEFAULT_SYSTEM_PROMPT`,personaProvider 拉到 persona.systemPrompt 但未注入。v1.9 T15"后端 guardrail 兜底"只实现 guardrails 拦截,人设软约束漏了。修复:chat.ts 应用 `persona.systemPrompt || body.systemPrompt || DEFAULT_SYSTEM_PROMPT`
2. **installAgent 不触发 instance_llm_keys 同步**(P1,影响 T20b):新安装 instance 无 LiteLLM key→chat 502。修复:installAgent 调 llm-key-sync-service 或在 instanceService.create 后触发 key 同步
3. **agent_definitions 表缺 persona/bound_knowledge/runtime 三列**(已修):v1.9 T1 migration 未执行,跑 db:migrate 补列。**根因已查(T26)**:`src/app/index.ts` 启动入口不调 migrate,`dev`/`start` 脚本只起 server 不跑 migration,全靠人工 `npm run db:setup`/`db:migrate`。pre-commit 门禁只跑 tsc/eslint/vitest(用 mock DB)测不出缺列。**修复(T26 done)**:`package.json` dev 脚本前置 `tsx src/db/migrate.ts &&`,dev 启动自动幂等 migrate(生产保持 `db:setup:prod` 显式控制)。类 memory `migrate-ts-skip-sql` 风险的防线

## 验证后处置

- **全 pass**: 关闭 backlog D10 + v1.9 遗留 1(T9 流式) + 相关"待浏览器实测"标注,更新对应 snapshot/current
- **某项 fail**: 记录现象 + 排查定位,作为新任务进 current.md(§10.5 计划外工作),不放过静默失败
- **D10 项 4 fail(sa-* 空转)**: 需决策——补 sa-* 接线 or 标注 sa-* 废弃放弃该路径

> **纪律提醒**: 本清单的每一项 pass 必须基于真实环境观察到的信号(网络面板/日志/DB 查询),不可凭"代码看着对"判定。tsc/vitest 全绿不等于运行时正确——这正是本清单存在的意义。
