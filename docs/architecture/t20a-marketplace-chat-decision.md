# T20a 决策 — marketplace「对话」半成品

> **状态**: [IMPLEMENTED] 选项 A(安装即对话)已实施 2026-06-25(T20b);真对话响应待浏览器实测(类 D10)
> **债务**: backlog D9（"marketplace 对话半成品"，P2 未排期）
> **核实日期**: 2026-06-25

## 深度核实（决定规模，非 1 天接线）

### openclaw chat 全依赖 instanceId

读 `server/src/routes/openclaw/chat.ts`：guardrail / persona / apiKey **全部从 `instanceId` 拉**：
- `personaProvider.getPersona(instanceId)`（chat.ts:110）—— guardrail 拦截 + persona 注入
- `aiGatewayRepo.getInstanceKey(instanceId)`（chat.ts:149）—— 取实例 apiKey 调 LiteLLM
- `isAuthorized(instanceId, modelName)`（chat.ts:136）—— 配额授权

**结论**：marketplace agent 对话要真响应（非空转），**必须有 instance**。无 instance → guardrail 不生效 + 无 apiKey → 对话失败/空转。这把"安装即对话"从"建对话上下文"升级为"创建可运行实例"。

### marketplace agent 无运行时定义

`marketplaceStore.agents`（MOCK `mka-*`）+ `MarketplaceClient`（外部 clawhub 代理）的 agent 只有 `name/description/capabilities/icon`，**无 persona / runtime / boundTools / model**。转可运行需落 `AgentDefinition`（v1.3 CRD，v1.9 T2 有 CRUD）+ 填默认值：
- persona: `"你是{name}，{description}"`
- runtimeType: `openclaw`（默认）
- boundTools: `[]`（空，marketplace agent 未声明工具）
- model: 默认模型

### SharedAgent @deprecated，方向 capabilityRegistry

`agentStore.sharedAgents`（`sa-*`）标 `@deprecated Use capabilityRegistry`。`CapabilityRegistry.registerAgent(templateId, agent)` 要求 templateId 在 8 个预置模板内，marketplace agent 不在其中。选项 A "转 capabilityRegistry active agent" 需扩展模板或改用 AgentDefinition CRD（推荐后者，走 v1.3/v1.9 已就绪链路）。

### sharedAgentChatService 兼容性（无硬阻断）

`openclawSharedAgentActions.startSharedAgentChat(agentId)` 接受**任意** agentId 字符串（convId=`shared-${agentId}`），不强制 `sa-*`。所以前端对话上下文可建——但**真响应依赖 instanceId**（见上）。

### 规模判定

选项 A 全量（installAgent → 创建 AgentDefinition + instance → 对话真响应）：后端 marketplace-service.installAgent（落 AgentDefinition + createInstance 关联 agentDefinitionId）+ 前端 marketplaceApi.installAgent + MarketplacePage 对话改"安装→sharedAgentChatService.open(instanceId)" + 测试。**2-3 天跨 context 集成**，运行时实测需真实 openclaw runtime（类 D10 风险，tsc/vitest 测不出）。

---

## Context

backlog D9 记录：`MarketplacePage.tsx` 两处点 Agent「对话」仅 `setDock` 跳转、不建对话上下文。根因是 `marketplaceStore.agents`（市场模板）与 `agentStore.sharedAgents`（组织共享 Agent）id 体系不兼容，无法直接 `startSharedAgentChat`。需产品决策后实现（T20b）。

本文件为 T20a 决策方案，不写代码。

## 现状核实

### 两处「对话」均为空跳转

`client-suite/apps/web/src/presentation/features/studio/MarketplacePage.tsx`：

| 位置 | 代码 | 问题 |
|---|---|---|
| 详情页 agent（:259-262） | `useUIStore.setDock('openclaw')` + toast | 只切 dock，不传 agentId，不建对话 |
| 列表 agent（:402-405） | `useUIStore.setDock('messages')` + toast | 只切 dock，且与详情页跳的 dock 不一致 |

两处都不调 `sharedAgentChatService.open`，不建对话上下文。backlog 所述"治本(setDock 对齐 appMode)已防撕裂"仅消除了跳转撕裂，未解决"无对话"。

### id 体系不兼容（backlog `mk-*` 标注不准，已修正）

| 体系 | id 前缀 | 来源 | 性质 |
|---|---|---|---|
| marketplace skill | `mk-*` | `marketplaceStore.skills`（MOCK + marketplaceApi） | 市场技能模板 |
| marketplace agent | `mka-*` | `marketplaceStore.agents`（MOCK + marketplaceApi） | 市场Agent模板 |
| 共享 Agent | `sa-*` | `agentStore.sharedAgents`（MOCK，**@deprecated**） | 组织已安装共享 Agent |
| 活跃 Agent | capabilityRegistry | `capabilityRegistry.registerAgent/getActiveAgent` | sa- 的真实替代方向 |

`sharedAgentChatService.open(agentId, name)` → `openclawStore.startSharedAgentChat(agentId)`，期望 `sa-*`/capabilityRegistry active agent id。`mka-*` 不在其中，直接调必失败。

### 三重障碍

1. **无 installAgent**：`marketplaceApi` 只有 `installSkill`（:73），agent 无安装 API。marketplace agent 无法变成 sa-/capabilityRegistry active agent。
2. **sa- 体系 @deprecated**：`agentStore.sharedAgents` 标 `@deprecated Use capabilityRegistry.getAvailableTemplates()`（:57）。接 sa- 是接废弃方向。
3. **模板无运行时**：marketplace agent 是"市场模板"，无实例/运行时。对话必须有 openclaw runtime + instance（D8 AgentRuntimePort）。

## 修复方案选项

### 选项 A — 安装即对话（转 capabilityRegistry active agent）

点「对话」→ 若未安装，调新增的 `marketplaceApi.installAgent`（后端 marketplace-service + 前端）→ 安装后 marketplace agent 转成 capabilityRegistry active agent → 跳 IM 调 `sharedAgentChatService.open(activeAgentId, name)`。

- 优点：符合"浏览→安装→使用"产品语义；复用 D8 已治本的 sharedAgentChatService；走 capabilityRegistry 长期方向（非 @deprecated sa-）
- 工作量：后端 installAgent（marketplace-service 加 method + route）+ 前端 marketplaceApi + 安装后 capabilityRegistry 注册 + 对话跳转，约 1.5 天
- 待核实：`sharedAgentChatService.open` 能否接 capabilityRegistry active agent id（当前注释绑定 openclawStore，需确认 startSharedAgentChat 对非 sa- id 的兼容性）

### 选项 B — marketplace 独立对话入口（临时 runtime）

marketplace agent 对话不经安装，用临时 runtime 实例。点「对话」→ 临时实例化 marketplace agent 模板 → 新建对话上下文（不走 sharedAgentChatService，新建 marketplace 对话 store）。

- 优点：不污染共享 Agent 列表（对话即用即弃）
- 缺点：需设计"模板对话运行时"，与 D8 AgentRuntimePort 解耦方向重复造轮子；工作量 2-3 天
- 风险：临时实例的生命周期/资源清理

### 选项 C — 轻量：对话=安装+跳转（选项 A 子集）

点「对话」→ 调 `installAgent`（若无）→ 安装成功后跳 IM dock + `sharedAgentChatService.open`。不处理"已安装"状态判断，最小闭环。

- 优点：最小可行，0.8 天
- 缺点：重复安装需幂等；未覆盖"未安装直接对话"场景

## 推荐

**选项 A**。理由：
- 走 capabilityRegistry 长期方向，不接 @deprecated sa-
- 复用 D8 已治本的 `sharedAgentChatService`（AgentRuntimePort 解耦），不重复造对话运行时
- 符合 marketplace 产品语义（安装后使用）
- 工作量可控（1.5 天），后端 installAgent 是主要新增

选项 B 仅在"对话即用即弃、不持久化"是硬需求时优选（需用户确认产品语义）。

## 待用户决策

1. marketplace「对话」产品语义：**安装后对话**（选项 A/C）还是**即用即弃**（选项 B）？
2. 是否接受补后端 `marketplaceApi.installAgent`（marketplace-service 加 install method + route，挂 auth，分页/幂等）？

决策后 T20b 实现依选项展开。本方案归档为决策材料。

---

## T20b-A 实施记录（2026-06-25，安装即对话已交付）

**用户决策**: 选项 A（安装即对话，转 AgentDefinition CRD + createInstance）。

**实施**（跨 context 集成，8 文件）:
- 后端 `marketplace-service.installAgent`:marketplace agent 模板 → AgentDefinitionSpec(defaultAgentDefinitionSpec + persona.systemPrompt=`你是{name},{description}` + runtime='openclaw' + boundTools=[]) → agentDefinitionService.create → instanceService.create(source='marketplace',agentDefinitionId 关联) → 返回 instanceId。
- 后端 `routes/control/marketplace.ts`:POST /agents/install(挂 auth + zod)。
- 后端 `bootstrap.ts`:marketplaceService 注入 agentDefinitionService + instanceService(均 :218/:222 早构造,无顺序问题)。
- 前端 `marketplaceApiClient.installAgent` + `sharedAgentChatService.openInstalledInstance` + `openclawStore.setActiveInstanceId`(+ returnToPrimaryAgent/returnToHome/reset 同步重置) + `MarketplacePage` 两处对话改 installAgent→openInstalledInstance→setDock('messages')。

**核实中发现的隐藏断点(T20a 未记录,影响比 marketplace 更广)**:
openclawStore.activeInstanceId **只有初始值 null + reset,无任何 setter 设非 null**。而 useAgentChat:325 chat 请求带 `instanceId: activeInstanceId`。故 **所有共享 Agent 对话(含已有 sa-*)chat 都 instanceId:null → persona/apiKey/guardrail 全失效 → 走 mock/默认**。这是 D10「待浏览器实测」的根因,非 marketplace 独有。T20b-A 通过 openInstalledInstance 设 activeInstanceId=instanceId 修复 marketplace 路径;sa-* 旧路径因 agentId 非 instanceId 仍空转(其本就 @deprecated,不在 T20b 范围)。

**未覆盖(留浏览器实测,类 D10)**:
- marketplace agent 安装后真对话响应(openclaw chat 经 LiteLLM,instanceId→persona/apiKey 真请求)需浏览器实测。tsc/vitest 测不出运行时真请求。
- 重复安装幂等性:当前每次 install 都新建 AgentDefinition + instance(非幂等)。文档选项 A 提"幂等"未实现,留待补(查已安装 → 复用 instance)。

**验证**: tsc/eslint 全过;server 1578 测 + client 805 测全过;新增 marketplace-service installAgent 2 测 + sharedAgentChatService openInstalledInstance 1 测。
