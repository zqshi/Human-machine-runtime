# Gateway 契约缺口对照表(v1.2.1 T1 产出)

> 状态:[IMPLEMENTED] 核查结论;T3 处置进行中
> 用途:确认 claude-worker 的外部直连点 vs `gateway/clients` 已封装契约,为 T3「主路径接回契约」提供改造范围依据。

## 核查结论

**claude-worker 容器内直连 Anthropic API 的 `ANTHROPIC_API_KEY` 是唯一被绕开 `gateway/clients` 的外部直连点。** 其余外部服务(clawhub/marketplace、portal、xspace/workspace、claw-farm/container-orchestrator、LiteLLM、WeKnora、cluster-instance)全部经 `gateway/clients` 封装并由 `bootstrap.ts` 注入,未发现直连绕开。

## 对照表

| 外部服务 | 直连点(绕开 client) | gateway client 封装 | bootstrap 注入点 | 状态 |
|---|---|---|---|---|
| Anthropic API(claude-worker) | `ANTHROPIC_API_KEY` 注入 worker 容器(`docker-worker-runner.ts:93`),SDK 内部直连 | ❌ 无 client 封装 | `bootstrap.ts:349` 构造 `ClaudeAgentSdkAdapter` | **唯一缺口 → T3** |
| LiteLLM | 无 | `litellm-client.ts` | `bootstrap.ts:283` `LiteLlmClientAdapter` / `:582` TraceSyncJob / `:587` EvalService / `:618` LlmAgentInvoker | ✅ 已封装 |
| Marketplace(clawhub) | 无 | `marketplace-client.ts` | `bootstrap.ts:443` McpService / `:450` MarketplaceService | ✅ 已封装 |
| Profile Service(portal) | 无 | `profile-service-client.ts` | `bootstrap.ts:458` AgentProfileService | ✅ 已封装 |
| Workspace Backend(xspace) | 无 | `workspace-backend-client.ts` | `bootstrap.ts:452` WorkspaceService | ✅ 已封装 |
| Container Orchestrator(claw-farm) | 无 | `container-orchestrator-client.ts` | `bootstrap.ts:197` WpsChannelAdapter / `:247` Provisioner / `:748` WsBridge | ✅ 已封装 |
| Cluster Instance | 无 | `cluster-instance-client.ts` | `bootstrap.ts:341` OpenClawAdapter | ✅ 已封装 |
| WeKnora | 无 | `weknora-client.ts` | `bootstrap.ts:515` 条件实例化 | ✅ 已封装 |

## T3 处置方向

claude-worker 缺口非「补一个 Anthropic client」可解——Claude Agent SDK 在容器内执行,其 LLM 调用是 SDK 黑盒,无法在外层替换为 HTTP client 调用。私有化(内网无 Anthropic 出口)采用**双路径**:

- **路径 A**:向 worker 容器注入 `ANTHROPIC_BASE_URL`,让 SDK 经企业 Anthropic 兼容代理(LiteLLM `/v1/messages` 兼容端点或自建代理)转发。保留 SDK 完整能力(沙箱执行/工具编排),但需实测国产模型经 LiteLLM 能否支撑 Agent SDK 完整功能。
- **路径 B**:私有化默认走 `LiteLLM + AgentExecutor` 降级路径(`bootstrap.ts:283` 已就绪,配 `AGENT_LLM_MODEL`),不依赖 claude-worker。放弃 Agent SDK 高级能力,但确定可用。

两条路径环境自选,`docker-compose` 补 LiteLLM 服务编排 + 文档说明选择规则。

## 附:降级守卫现状(T2 核查结论)

`gateway/clients/base-client.ts` 已具备 `isConfigured()` / 熔断 / 退避重试 / 超时 / 审计 sink,基础设施完善。

**T2 核查结论:现有架构已完整建立调用方守卫机制,无需实质改动。** 架构模式见 `gateway-clients.ts:4-6` 注释——"统一返回实例,调用方按 `client.isConfigured()` 自行判断"(配置判断是调用方职责,非 client 方法职责)。逐个核查:

| 调用方 | 守卫 | 证据 |
|---|---|---|
| marketplace-service | ✅ 抛 not configured | `marketplace-service.ts:62` |
| agent-profile-service | ✅ 抛 not configured | `agent-profile-service.ts:36` |
| workspace-service | ✅ 抛 not configured | `workspace-service.ts:50` |
| wps-adapter(container-orchestrator) | ✅ return/返回空/error | `wps-adapter.ts:36/46/66` |
| container-orchestrator-provisioner | ✅ 抛/return | `container-orchestrator-provisioner.ts:9/29` |
| litellm | ✅ LiteLlmClientAdapter.isAvailable | `litellm-llm-client.ts:37`(llmModel 判空) |
| weknora | ✅ 条件实例化 | `bootstrap.ts:515`(未启用=null) |
| OpenClawAdapter.healthCheck | ✅ try/catch 返回 unhealthy | `openclaw-adapter.ts:108` |

`litellm-client`/`weknora-client` 方法内未调 `isConfigured` 是设计如此——litellm 有默认 baseUrl(`localhost:4000`),其"未配置"语义由 Adapter 的 `isAvailable` 处理;weknora 未启用时不实例化。给 client 方法强加 `isConfigured` 守卫会违反 §4.3(无谓改动)且破坏既有的"配置判断下沉调用方"架构。T2 以核查确认达成,不补码。

> **附注**:`OpenClawAdapter` 是模拟桩(`simulateProgress` setTimeout 5s 硬编码返回"任务执行完成"),非真实执行。私有化降级必须靠路径 B(LiteLLM+AgentExecutor 真实执行),不可依赖 OpenClawAdapter 空转。这是 T3 双路径设计的必要性的另一印证。
