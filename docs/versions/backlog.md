# HMR 版本积压（Backlog）

> 已规划但未启动的版本与长期技术债务。当前活跃版本见 `*-current.md`。

## 版本路线

| 版本 | 主题 | 状态 | 备注 |
|------|------|------|------|
| v1.0.x | 投产工程 4 阶段 | done | 见 `memory/MEMORY.md` 与 git log |
| v1.1.x | 流程可用性补强（Conduit/配额/调度重试/实例自愈） | done | 见 `memory/MEMORY.md` |
| v1.2.1 | 投产外部契约收尾 + 私有化前置 | done | snapshot 已归档；claude-worker 双路径 + 配置修复 + credential 后端 + 集成测试端到端实测通过 |
| v1.2.2 | 商业模式闭环（计费/套餐/用量报表） | current 进行中 | v1.9 归档后激活(2026-06-24);内部推广暂不计费,择机开工 |
| v1.3-v1.7 | 云原生声明式 Agent 平台（声明/组装/trace/eval） | done | snapshot 已归档（v1.3-v1.7-snapshot.md）；4 版连续完成，架构总纲 `docs/architecture/cloud-native-platform-design.md` |
| v1.8 | 声明/运行 reconcile 解耦 | done | snapshot 已归档(v1.8-snapshot.md);desiredState+generation+spec-diff 调和,云原生收官;遗留:Container 扩容限制 + bootstrap.ts 832 行技术债 |
| v1.9 | 投产就绪:Agent 声明式创建升级 + #1拒答/#7审批/#13灰度 + D8治本 | done | snapshot 已归档(v1.9-snapshot.md);7步声明式向导+AgentRuntimePort解耦useAgentChat+管理后台UI(审批/flag/模板);遗留:T9流式待浏览器实测+openclaw后端guardrail兜底 |

## 长期技术债务

> 来源: 版本完成质量门禁的"记录项"（CLAUDE.md §14）、领域模型健康度审计（§12）发现的问题。

| ID | 债务 | 来源版本 | 优先级 | 处置版本 |
|----|------|---------|--------|---------|
| D1 | eval-benchmark 是 STUB（actualOutput 占位），需接真实 Agent | v1.2.1 | P2 | ✅ 已解决 v1.7（eval 真实化，接真实 AgentInvoker + trajectory 评测） |
| D2 | knowledge + employee-memory 检索能力未进 agent 决策回路（仅 Matrix 命令手动查） | v1.2.1 | P1 | ✅ 已解决（rag-context-provider 接入 harness.ts，knowledge 进 RAG 召回回路） |
| D3 | tool-management executor 与 claude-agent-sdk 主链路脱节 | v1.2.1 | P2 | v1.3+ |
| D4 | credential-vault 前端管理面（后端 API 已就绪，T10） | v1.2.1 | P2 | v1.3+ |
| D5 | tool-management db 连接解锁接入（credentialManagementService.getCredentialSecret 已提供，需注入 ToolManagementService） | v1.2.1 | P2 | ✅ 已解决 2026-06-25（投产收尾 T12：定义 `CredentialSecretProvider` 端口注入 ToolManagementService，syncDatabase/executeTool/testConnection 经 resolveCredential 解密，id string↔number 对齐） |
| D6 | credential-repository 集成测试（DB 层，mock Database） | v1.2.1 | P3 | v1.3+ |
| D7 | bootstrap.ts 832 行装配 god-file（§14.1 第 10 项 800-1000 行技术债） | v1.8 质量检测 | P2 | ✅ 已清 2026-06-24：拆 8 个 bundle 到 `app/bootstrap/`，832→542 行；type-check + 1455 单测 + 真实 dev 启动验证全过 |
| D8 | **openclaw 运行时可替换 / Agent 定义与运行分离**：`useAgentChat`→`weKnoraApi`/`openclawApiAdapter`/`/api/openclaw/chat` 与 `openclawStore` 会话状态机硬绑 openclaw 运行时；需抽象 `AgentRuntimePort` 接口以支持替换为 Hermes 等框架。2026-06-24 双模式修复已在 IM 内对话入口（`sharedAgentChatService.ts`）预埋最小 seams 并标 `TODO(runtime-port)`，但 `useAgentChat` 仍直接 import `openclawStore`，完整 Port 抽象未做。 | 双模式修复(计划外) | P1 | ✅ 已解决 v1.9（AgentRuntimePort 抽象 + useAgentChat 移除 weKnoraApi 硬绑，persona 从 instance→agentDefinitionId→AgentDefinition 拉）；遗留 2026-06-25 投产收尾 T15 已清（openclaw chat route 注入 PersonaProvider 作后端 guardrail 兜底）；仅余流式真请求待浏览器实测（见 D10） |
| D9 | **marketplace「对话」半成品**：`MarketplacePage.tsx` 两处点 Agent「对话」仅 `setDock` 跳转、不建对话上下文。根因：`marketplaceStore.agents`(id `mk-*`，市场模板) 与 `agentStore.sharedAgents`(id `sa-*`，组织共享 Agent) id 体系不兼容，无法直接 `startSharedAgentChat`。需产品决策（先安装为共享 Agent 再对话？还是独立入口？）后实现。2026-06-24 排查后主动回退了误改，治本(`setDock` 对齐 `appMode`)已防撕裂，完整实现留此条。 | 双模式修复(计划外) | P2 | 未排期 |
| D10 | **openclawStore 跨模式自举真请求验证缺口**：IM 模式内共享 Agent 对话复用 `useAgentChat`+`openclawStore`，`sharedAgentChatService.open` 已调幂等 `initConversation()` 准备状态机，但 IM 模式未走 `appMode==='openclaw'` 的 `initialize()`(拉通知/事件等 OC 专属数据)。逻辑自举由 `conversationActions`(initConversation 幂等 + switchConversation 自建空对话) 保证，但真请求流式回包未经浏览器验证（tsc/vitest 测不出，类 `migrate.ts 不跑 .sql` 风险）。需 IM 模式实际发一条消息确认。 | 双模式修复(计划外) | P2 | 待浏览器验证 |
| D11 | **WpsImAdapter 7 个 NotImplementedError 未实现**：editMessage/redactMessage/createDmRoom/inviteToRoom/createGroupRoom/joinRoom/leaveRoom。`useMatrixClient.loginWps` 会实例化 WpsImAdapter，但投产未启用 WPS IM 通道(决策 2026-06-25)，不阻断。启用该通道时需对照 WPS IM 协议(farmBaseUrl API)补齐。 | 投产收尾 T6 | P2 | 未排期(投产未启用 WPS IM) |

## 候选方向（未排期）

- **SSO (OIDC/SAML)**: `system_configs` 已预留开关，待企业客户需求触发
- **数据层抽象**: 引入后可重新开启 `react-hooks/set-state-in-effect` 规则（见 CLAUDE.md §2.3）
- **DB 死列清理**: `xspace_app_id` 等遗留字段（见 `memory/MEMORY.md` ghost-client 治理条目）
- **openclaw 子系统**: 不在 HMR 主路径，独立处置
- **MCP 客户端**: 当前 `tool-management` 只做 executor，双向集成待评估
