# Matrix Bot 对话闭环 — 端到端实测清单（T57）

> 代码侧已 done（门禁 tsc 0 + vitest 1737 + eslint 0）。本清单为**用户侧实测**，验证 Matrix bot 真实接入可用。
> 实测执行不阻断代码合并，但投产前必修。

## 前置认知

- Matrix 全栈基础设施已就绪：Conduit（docker 部署 6167）+ 前端 matrix-js-sdk 完整 IM 客户端（已接入 App.tsx 主 UI，人↔人 IM 可用）+ 后端 MatrixChannelAdapter（真发 CS API v3）。
- T57 补的唯一缺口：后端 bot 对话闭环。消息**始终走 Matrix 协议**（bot 调 LLM 是"大脑"，回复经 `MatrixChannelAdapter.sendMessage` 发回房间）。
- **不做 IM 绑定**：IM 是 opt-in 模式。不强制用户绑 Matrix 账号、不强制 instance 绑房间。`MatrixBot.processTextMessage` 已内置分流（绑定房间/`!`命令/NLU 意图才回复，人↔人消息返回 `ignored` 不回发）。

## 1. 环境准备

### 1.1 启动 Conduit homeserver

```bash
docker compose --profile full up -d   # 含 matrix-conduit:6167
# 验证: curl http://localhost:6167/_matrix/client/versions
```

### 1.2 注册 bot 账号 + 拿 access_token

按 README §"Matrix (Conduit) Bot 注册"：
1. 用 Element 或 API 在 Conduit 注册 `@hmr-bot:localhost` 账号
2. 登录拿 access_token
3. 填 `server/.env`：
   ```
   MATRIX_HOMESERVER_URL=http://localhost:6167
   MATRIX_BOT_USER_ID=@hmr-bot:localhost
   MATRIX_BOT_ACCESS_TOKEN=<step2 token>
   MATRIX_CONVERSATION_MODE=runtime_proxy
   ```

### 1.3 起 server

```bash
cd server && npm run dev   # 日志应见 "matrix bot started" + simulation:false
```

### 1.4 LiteLLM 就绪

bot 对话经 LiteLLM 调国产模型（glm-4-flash）。确认 LiteLLM（4000）+ LITELLM_API_KEY 配置（见 memory grey-zone-runtime-env）。`/api/openclaw/chat` 手测能回。

## 2. 实测用例

### 用例 1：bot 对话回复（核心）
1. 前端 IM 客户端登录 Conduit（LoginPage，用 Conduit 账号）
2. 创建/进入一个房间，邀请 `@hmr-bot:localhost` 加入
3. **关联 instance 到房间**（IM opt-in，二选一）：
   - 在房间发 `!create_agent 创建财务助手` → MatrixBot 命令创建 instance + 关联 roomId
   - 或调 control route 给已存在 instance 绑 roomId（若已实现 POST /instances/:id/matrix-room）
4. 房间发"你好"
5. **预期信号**：
   - bot `@hmr-bot` 在房间回复（非空话术）
   - server 日志见 `matrix.command.received` 或 `matrix.channel.passthrough.succeeded`
   - 回复在 Element 客户端多端可见（证明走 Matrix 协议非 HMR 内部直返）

### 用例 2：persona.systemPrompt 生效
1. 给 instance 配 persona（systemPrompt="你是Alice财务助手，只回答财务问题"）
2. 房间发"你是谁"
3. **预期**：回复体现 Alice 财务助手身份（非默认"企业AI助手"话术）。证明 persona 注入链路通（复用 chat.ts T24）。

### 用例 3：多轮记忆（MatrixConversationStore）
1. 房间发"我叫张三，工号F001"
2. bot 回复"已记录"
3. 追问"我叫什么名字？工号多少？"
4. **预期**：bot 回答"张三，工号F001"（修复前会失忆）。证明后端按 roomId 存历史生效。
5. **注意**：内存态，server 重启丢历史（已知债，记 backlog 升级 DB）。

### 用例 4：人↔人消息 bot 不介入
1. 另一用户加入同一房间
2. 两用户互相发消息（不 @bot）
3. **预期**：bot 不回复（`processTextMessage` 返回 `ignored` 不回发）。人↔人走 Matrix 原生。

### 用例 5：guardrail 拒答
1. 给 instance 配 persona.guardrails（如"禁谈薪资"→block）
2. 房间发"你的工资多少"
3. **预期**：bot 返回 persona.refusalResponse 拒答话术（非真实回答）。证明 guardrail 链路通（复用 chat.ts T15）。

### 用例 6：!命令
1. 房间发 `!list_agents`
2. **预期**：bot 返回 agent 列表（MatrixBot 命令处理，已实现）。

## 3. 排查

| 现象 | 排查 |
|------|------|
| bot 不回复 | 检查 `MATRIX_BOT_ACCESS_TOKEN` 非空 + bot 已加入房间 + server 日志 `simulation:false` + 房间是否关联 instance（resolveInstanceByRoomId） |
| 回复失忆 | 确认 `MatrixConversationStore` 注入 RuntimeProxyService（bootstrap 装配）+ 同一 roomId |
| 回复是默认话术 | persona 未配置或 personaProvider 未就绪；查 `personaProvider.getPersona` 返回 |
| 503 LiteLLM 未配置 | LiteLLM（4000）未起或 `LITELLM_API_KEY` 未配 |
| 502 调用失败 | LiteLLM 日志查模型可用性（glm-4-flash） |
| bot 回复但 Element 看不到 | 确认 `MatrixChannelAdapter.sendMessage` 发到正确 roomId + bot 在该房间 |

## 4. 走 Matrix 协议验证（关键）

验证 bot 回复**真实经 Matrix 协议**（非 HMR 内部直返）：
- 在 **Element 客户端**（独立 Matrix 客户端，非 HMR 前端）登录同一 Conduit，加入房间 → 应见 bot 回复（多端同步证明走 Matrix）
- 或 curl Conduit `GET /_matrix/client/v3/sync` 见 bot 发的 m.room.message 事件

## 5. 已知遗留（不阻断实测）

- 多轮记忆内存态：server 重启丢历史（与 dispatch conclusion 同类债），记 backlog 升级 DB（新建 matrix_conversation_history 表 + migration）
- 评分决策路径失去 Matrix 输入：Matrix 消息改走 bot 对话后不再进 runtime-engine 评分决策 handler（IM 闲聊不应落 Decision，既有行为是债）
- chat 路径用量未入账（T48 遗留 C）：ChatService 落 trace 但未调 recordUsage（与 tool-loop 一致待补）
