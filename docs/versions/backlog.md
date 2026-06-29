# HMR 版本积压（Backlog）

> 已规划但未启动的版本与长期技术债务。当前活跃版本见 `*-current.md`。

## 版本路线

| 版本 | 主题 | 状态 | 备注 |
|------|------|------|------|
| v1.0.x | 投产工程 4 阶段 | done | 见 `memory/MEMORY.md` 与 git log |
| v1.1.x | 流程可用性补强（Conduit/配额/调度重试/实例自愈） | done | 见 `memory/MEMORY.md` |
| v1.2.1 | 投产外部契约收尾 + 私有化前置 | done | snapshot 已归档；claude-worker 双路径 + 配置修复 + credential 后端 + 集成测试端到端实测通过 |
| v1.2.2 | 商业模式闭环（计费/套餐/用量报表） | done 归档 | snapshot 已归档(2026-06-28);**计费主题 T4-T11 未完成转本 backlog D15**;实际完成投产收尾 T12-T59+架构债 T45-T47+cockpit 改名 T60 |
| v1.3-v1.7 | 云原生声明式 Agent 平台（声明/组装/trace/eval） | done | snapshot 已归档（v1.3-v1.7-snapshot.md）；4 版连续完成，架构总纲 `docs/architecture/cloud-native-platform-design.md` |
| v1.8 | 声明/运行 reconcile 解耦 | done | snapshot 已归档(v1.8-snapshot.md);desiredState+generation+spec-diff 调和,云原生收官;遗留:Container 扩容限制 + bootstrap.ts 832 行技术债 |
| v1.9 | 投产就绪:Agent 声明式创建升级 + #1拒答/#7审批/#13灰度 + D8治本 | done | snapshot 已归档(v1.9-snapshot.md);7步声明式向导+AgentRuntimePort解耦useAgentChat+管理后台UI(审批/flag/模板);遗留:T9流式待浏览器实测+cockpit后端guardrail兜底 |
| v2.0 | 声明式+编译固化+运行时动态组装(架构升级) | current 进行中 | 2026-06-28 激活;本批先做 baking 链路(C1-C7/C11/C12/C14/C15)不依赖 KVM;CubeSandbox 半(C8/C9/C10/C13)留待 KVM 宿主(D14);设计文档 docs/architecture/v2.0-declarative-baking-runtime.md;任务图 docs/versions/v2.0-current.md |

## 长期技术债务

> 来源: 版本完成质量门禁的"记录项"（CLAUDE.md §14）、领域模型健康度审计（§12）发现的问题。

| ID | 债务 | 来源版本 | 优先级 | 处置版本 |
|----|------|---------|--------|---------|
| D1 | eval-benchmark 是 STUB（actualOutput 占位），需接真实 Agent | v1.2.1 | P2 | ✅ 已解决 v1.7（eval 真实化，接真实 AgentInvoker + trajectory 评测） |
| D2 | knowledge + employee-memory 检索能力未进 agent 决策回路（仅 Matrix 命令手动查） | v1.2.1 | P1 | ✅ 已解决（rag-context-provider 接入 harness.ts，knowledge 进 RAG 召回回路） |
| D3 | tool-management executor 与 claude-agent-sdk 主链路脱节（核实：主路径 dispatchTask→adapter→worker→SDK 绕开 ToolRegistryService.invoke，致审批/callLog/凭证/租户隔离/计费对主链路失效；治本需 worker↔server 工具调用 RPC，3-5 天架构任务。方案见 `docs/architecture/t18-tool-executor-mainline-gap.md`） | v1.2.1 | P2 | T18a 诊断 done（2026-06-25，SDK 0.1.77 核实 canUseTool 支持接管执行，单一机制治本路径明确）；T18b canUseTool 审批闭环 done 2026-06-25（worker canUseTool→server /api/internal/tool-check 内置工具风险表 + enforce flag + 共享密钥，代码+单测 done）；**真生效待 CLAUDE_WORKER_E2E=1 容器验证**；MCP 执行转发(凭证/计费)+ callLog 落库留后续独立任务。方案见 `docs/architecture/t18-tool-executor-mainline-gap.md` |
| D4 | credential-vault 前端管理面（后端 API 已就绪，T10） | v1.2.1 | P2 | ✅ 已解决 2026-06-25（T17：credentialManagementApi + CredentialSection/Create/Detail/LeasesTab + adminStore/AdminPage 挂载；完整覆盖 7 端点 CRUD+lease；门禁全过） |
| D5 | tool-management db 连接解锁接入（credentialManagementService.getCredentialSecret 已提供，需注入 ToolManagementService） | v1.2.1 | P2 | ✅ 已解决 2026-06-25（投产收尾 T12：定义 `CredentialSecretProvider` 端口注入 ToolManagementService，syncDatabase/executeTool/testConnection 经 resolveCredential 解密，id string↔number 对齐） |
| D6 | credential-repository 集成测试（DB 层，mock Database） | v1.2.1 | P3 | ✅ 已解决 2026-06-25（T19：17 用例 mock Drizzle db 链式 select/insert/delete/update，照 oauth-state-repository.test.ts 模式） |
| D7 | bootstrap.ts 832 行装配 god-file（§14.1 第 10 项 800-1000 行技术债） | v1.8 质量检测 | P2 | ✅ 已清 2026-06-24：拆 8 个 bundle 到 `app/bootstrap/`，832→542 行；type-check + 1455 单测 + 真实 dev 启动验证全过 |
| D8 | **cockpit 运行时可替换 / Agent 定义与运行分离**：`useAgentChat`→`weKnoraApi`/`cockpitApiAdapter`/`/api/cockpit/chat` 与 `cockpitStore` 会话状态机硬绑 cockpit 运行时；需抽象 `AgentRuntimePort` 接口以支持替换为 Hermes 等框架。2026-06-24 双模式修复已在 IM 内对话入口（`sharedAgentChatService.ts`）预埋最小 seams 并标 `TODO(runtime-port)`，但 `useAgentChat` 仍直接 import `cockpitStore`，完整 Port 抽象未做。 | 双模式修复(计划外) | P1 | ✅ 已解决 v1.9（AgentRuntimePort 抽象 + useAgentChat 移除 weKnoraApi 硬绑，persona 从 instance→agentDefinitionId→AgentDefinition 拉）；遗留 2026-06-25 投产收尾 T15 已清（cockpit chat route 注入 PersonaProvider 作后端 guardrail 兜底）；仅余流式真请求待浏览器实测（见 D10） |
| D9 | **marketplace「对话」半成品**：`MarketplacePage.tsx` 两处点 Agent「对话」仅 `setDock` 跳转、不建对话上下文。根因：`marketplaceStore.agents`(id `mk-*`，市场模板) 与 `agentStore.sharedAgents`(id `sa-*`，组织共享 Agent) id 体系不兼容，无法直接 `startSharedAgentChat`。需产品决策（先安装为共享 Agent 再对话？还是独立入口？）后实现。2026-06-24 排查后主动回退了误改，治本(`setDock` 对齐 `appMode`)已防撕裂，完整实现留此条。 | 双模式修复(计划外) | P2 | ✅ 已解决 2026-06-25（T20a 方案 done + T20b 选项 A 实现：installAgent 落 AgentDefinition+createInstance→sharedAgentChatService.openInstalledInstance→activeInstanceId→chat 真 instanceId；核实发现 activeInstanceId 全链路未接线断点已修 marketplace 路径）；遗留真对话响应待浏览器实测(类 D10) + 重复安装幂等性待补。方案见 `docs/architecture/t20a-marketplace-chat-decision.md` |
| D10 | **cockpitStore 跨模式自举真请求验证缺口**：IM 模式内共享 Agent 对话复用 `useAgentChat`+`cockpitStore`，`sharedAgentChatService.open` 已调幂等 `initConversation()` 准备状态机，但 IM 模式未走 `appMode==='cockpit'` 的 `initialize()`(拉通知/事件等 OC 专属数据)。逻辑自举由 `conversationActions`(initConversation 幂等 + switchConversation 自建空对话) 保证，但真请求流式回包未经浏览器验证（tsc/vitest 测不出，类 `migrate.ts 不跑 .sql` 风险）。需 IM 模式实际发一条消息确认。 | 双模式修复(计划外) | P2 | 待浏览器验证 |
| D11 | **WpsImAdapter 7 个 NotImplementedError 未实现**：editMessage/redactMessage/createDmRoom/inviteToRoom/createGroupRoom/joinRoom/leaveRoom。`useMatrixClient.loginWps` 会实例化 WpsImAdapter，但投产未启用 WPS IM 通道(决策 2026-06-25)，不阻断。启用该通道时需对照 WPS IM 协议(farmBaseUrl API)补齐。 | 投产收尾 T6 | P2 | ✅ 已解决 2026-06-25（T21：加 `VITE_WPS_IM_ENABLED` gate,WpsImAdapter 构造 fail-fast 守卫 + SettingsPage 选项过滤 + client `.env.example`;未启用即禁止实例化,防残留 wps-token 触发未实现方法。启用该通道时须先补齐 7 方法再设 `VITE_WPS_IM_ENABLED=true`） |
| D12 | cockpit 4 聚合统计端点全量 reduce 性能优化（/inbox、/judgment-analytics、/evaluation dual-track、/trends 返回聚合指标非 item 列表，不属 §7.2.1 分页管辖，但全量读取是性能债） | v1.2.2 T58 | P3 | 待排期 |
| D13 | cockpit 带 filter 端点 JSONB filter 索引优化（list+filter+slice 改 DB 层 where filter，消除全量读+内存 filter；实体 EAV+JSONB） | v1.2.2 T58 | P3 | 待排期 |
| D14 | CubeSandbox KVM 宿主部署（v2.0 C8 实测前置；代码只接 E2B SDK，宿主部署是运维侧，需支持 KVM 的 x86_64 Linux PVM） | v2.0 规划 | P1 | v2.0 C8 启动前 |
| D15 | **计费 T4-T11（v1.2.2 主题核心，归档时全 pending 转入）**：T4(quota↔analytics 贯通)/T6(用量报表 API)/T7(前端用量报表)/T8(用量异常告警)/T10(billing 写侧补全 consume/deduct/reserve)/T11(日终对账)。**启动前置**:用户确认商业化时机 + 灰区实测(Matrix E2E/cockpit 浏览器实测)。**前置依赖**:v2.0 manifest 落地后计费基于固化配额才不漂移(v2.0 设计文档 §10.3)。详见 v1.2.2-snapshot.md 遗留 + v2.0-current.md 任务详情 | v1.2.2 归档 | P0 | v2.0 manifest 落地后 |
| D16 | **EAOS 五子系统假智能 + 贫血模型（产品级阻断）**：cockpit 五子系统（战略驾驶舱/编排中心/感知反馈/考核评估/判断推理）框架齐全但智能内核缺失。①战略解码 `/decode`(routes/cockpit/objectives.ts) 返回硬编码 questions（任何输入同样问题），非真 LLM 解码；②"涌现信号"(signals.ts) 只有手动 CRUD 入库无提取算法；③全 EAV 通用表(CockpitRepository)无 Objective/Signal/Decision 领域实体（§12信号1 贫血模型 P1，与 D12/D13 性能债不同）；④cockpit 数据与 `/agent/dispatch` 主链路割裂无回流。详 `docs/versions/handoff-2026-06-28.md` §三。与已清的 B1/F4 假数据同类。**处置**：先盘点→清假智能(真LLM或诚实空态)→接回流→建domain实体。**进展(2026-06-29)**:①②假智能已清——`/decode`+评估洞察接真 LLM(`routes/cockpit/llm-analysis.ts`),signals/decisions/orchestration 假执行诚实化(C20 done,见 v2.0-current.md)。**剩余**:③domain 实体建模破贫血模型 + ④dispatch→涌现信号数据回流 + 判断节点识别/编排真路由接 LLM/dispatch | 2026-06-28评估/2026-06-29部分清 | P1 | 投产后或与计费并行 |

## 候选方向（未排期）

- **SSO (OIDC/SAML)**: `system_configs` 已预留开关，待企业客户需求触发
- **数据层抽象**: 引入后可重新开启 `react-hooks/set-state-in-effect` 规则（见 CLAUDE.md §2.3）
- **DB 死列清理**: `xspace_app_id` 等遗留字段（见 `memory/MEMORY.md` ghost-client 治理条目）
- **cockpit 子系统**: 不在 HMR 主路径，独立处置
- **MCP 客户端**: 当前 `tool-management` 只做 executor，双向集成待评估
