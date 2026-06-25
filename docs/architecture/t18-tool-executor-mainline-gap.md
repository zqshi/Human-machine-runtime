# T18 诊断 — tool-management executor 与 claude-agent-sdk 主链路脱节

> **状态**: [PARTIAL] 选项 C(止血)已实施 2026-06-25;选项 A(治本)待独立版本承载
> **债务**: backlog D3（v1.2.1 记录"P2 v1.3+"，本次核实更新）
> **核实日期**: 2026-06-25（SDK 深度核实于同日补入）

## 核实结论（决定规模，非 1 天接线）

worker.ts 位于 `infra/claude-worker/worker.ts`（**独立 docker 镜像**，改造需重建镜像 + docker-worker-runner 配合 + `CLAUDE_WORKER_E2E=1` 真实容器验证）。SDK 实际版本 **0.1.77**（worker.ts 注释"0.1.0"过时）。

### SDK 0.1.77 能力核实（命门）

读 `node_modules/@anthropic-ai/claude-agent-sdk/entrypoints/sdk/runtimeTypes.d.ts` + `agentSdkTypes.d.ts`：

1. **`canUseTool?: CanUseTool`**（runtimeTypes.d.ts:266）—— 注释明说 "Called before each tool execution to determine if it should be **allowed, denied, or prompt the user**"。即**审批钩子，不接管执行**。工具结果仍由 SDK 内置执行器产出。
2. **`tools`**（runtimeTypes.d.ts:288）—— `string[]` 是**内置工具名白名单**（如 `['Bash','Read']`）或 preset，**不是 custom tool handler 数组**。
3. **custom tool**（agentSdkTypes.d.ts:16）—— `tool(name, desc, inputSchema, handler)` 工厂返回 `SdkMcpToolDefinition`，**经 MCP server（sdkMcpServers）注入**，handler 是 async 可 fetch server。这是外部工具"执行转发 server"的唯一注入点。

### 治本需双机制（非单一接线）

| 机制 | 覆盖 | 注入点 | 复杂度 |
|---|---|---|---|
| canUseTool 审批钩子 | #7 审批 gate + callLog（对所有工具调用，含内置） | worker.ts options.canUseTool | 中（跨进程 fetch server /api/internal/tool-check + 内置工具默认风险策略） |
| MCP custom tool 执行转发 | 凭证解密 + 租户隔离 + 调用计数（仅外部工具） | worker.ts sdkMcpServers + tool() handler fetch /api/internal/tool-invoke | 高（MCP server 注入 + 工具 schema 从 server 拉 + handler RPC） |
| 内置工具（Bash/Read/Write/Edit/Glob/Grep/WebSearch/WebFetch）执行 | 仍在 worker 容器内（合理，内置工具本就该容器内执行） | — | 需 server 端对内置工具名有默认风险策略（approvalGate 不认识 Bash，无 ToolDefinition） |

### 规模判定

- 单 canUseTool 审批闭环（让 #7 审批 + callLog 对主链路生效）：server 端 2 endpoint（/api/internal/tool-check + /tool-log）+ 内部认证中间件（共享密钥，非 JWT）+ worker canUseTool handler + docker-runner 传 env + 内置工具风险策略 + 单测 + E2E（重建镜像）。**1.5-2 天**，E2E 需真实容器。
- 完整双机制治本（加 MCP custom tool 执行转发）：**3-5 天**，含 MCP server 注入 + 工具 schema 协议 + 跨进程容错 + E2E。

tsc/vitest 只能测 server route + worker handler 函数逻辑；**跨进程真实调用（worker 容器 → server）+ 真实 SDK 工具执行必须 CLAUDE_WORKER_E2E=1 容器验证**（类 D10/T16 风险）。



## 现状：两条工具执行路径并存

核实 `server/src/contexts/agent-core/` 后确认存在两条互不相交的工具执行路径：

### 路径 A — AgentExecutor（已接 registry，但非实例主链路）

```
harness.execute() → AgentExecutor.execute()
  → agent-executor.ts:554 registry.discover()
  → agent-executor.ts:561 registry.invoke()
  → ToolRegistryService.invoke()         ✅ 经审批 gate / callLog / 凭证 / 租户隔离
  → ToolManagementService.executeTool()
  → executor-factory.getExecutor().execute()
```

- 注入点：`harness.setToolRegistry`（harness.ts:297）→ `AgentExecutor.setToolRegistry`（agent-executor.ts:499）
- **但**：`harness.execute()` 是意图分类 + Artifact 创建路径（注释 harness.ts:34 "execute 内部仍调原 AgentExecutor"），**不是实例任务执行主链路**。

### 路径 B — claude-agent-sdk（实例主链路，绕开 registry）

```
harness.dispatchTask()                    ← 实例任务主链路汇聚点
  → sandbox.dispatchTask()
  → claude-agent-sdk-adapter.submitTask()
  → WorkerRunOptions{ allowedTools: string[] }   ← 只传工具名数组
  → docker worker 内 claude SDK 自行执行工具      ✗ 不回调 server
```

- adapter 全文（365 行）工具相关**仅 `parseAllowedTools`**（:145 传给 worker payload + :362 函数定义），**无任何 `registry.invoke` / `executeTool` / tool 回调**。
- worker 容器内 SDK 用自己的 tool use 协议执行工具（allowedTools 仅做工具名白名单过滤），**结果不回传 server**。

## 断点影响

路径 B 绕开 `ToolRegistryService.invoke`，导致实例任务的工具调用：
- ✗ 不经 #7 审批 gate（`approvalGate.checkAndMaybeBlock`，v1.9 T4）—— 高风险工具无人工审批
- ✗ 不写 `tool_call_logs`（callLog）—— 无调用审计、无法追溯
- ✗ 不经凭证解密（`resolveCredential`）—— DB/gateway 工具的凭证链路失效
- ✗ 不经租户隔离校验（`invoke` 的 `def.tenantId !== req.context.tenantId`）—— 跨租户风险
- ✗ 不更新调用计数（`incrementCallCount`）—— 用量统计失真，影响计费

即：v1.9 投产就绪做的 #7 审批、v1.2.1 做的凭证链路、计费用的调用计数，**对 claude-agent-sdk 实例任务路径全部失效**。

## 修复方案选项

### 选项 A — worker↔server 工具调用 RPC（治本，3-5 天）

扩展 worker 协议：SDK tool use handler 拦截工具调用 → 序列化回 server → server 端 endpoint 调 `ToolRegistryService.invoke` → 回传结果给 worker。

- 涉及：`WorkerRunOptions` 加 tool-call 通道 + worker.ts 注入 SDK tool handler + server 新增 `/api/internal/tool-invoke` endpoint + 跨进程容错（超时/worker 重启）
- 优点：所有工具调用收口到 ToolRegistryService，审批/日志/凭证/计费全生效
- 风险：跨进程 RPC 协议设计 + worker 容器内 SDK handler 注入（claude-agent-sdk API 约束），回归面大
- 跨仓风险：worker.ts 若在 claude-worker 仓库则跨仓改动（memory 记 v1.4 时 worker.ts 在本仓可改）

### 选项 B — MCP server 桥接（中等，2-3 天）

把 ToolRegistryService 暴露为 MCP server，worker 内 SDK 经 MCP 协议调用工具（复用现有 `mcp-client.ts` + `mcpCallExecutor` 路径）。

- 优点：复用现有 MCP 链路，不造 RPC 协议
- 缺点：ToolRegistryService → MCP server 适配层需新建；MCP 协议 overhead；审批 gate 需在 MCP handler 内补
- 适用：若 worker 已支持 MCP tool use

### 选项 C — 维持现状 + 显式标注（0.5 天，治标）

不实现 RPC，在 adapter/worker 注释 + 投产文档显式标注"claude-agent-sdk 实例路径工具不经审批/日志/凭证"，限制该路径只用无副作用工具（read-only），有副作用工具强制走 AgentExecutor 路径或禁用。

- 优点：零回归风险，立刻可做
- 缺点：不治本，审批/计费对主链路仍失效；限制 Agent 能力

## 推荐

**选项 C 先做（止血）+ 选项 A 排入下版本（治本）**。理由：
- 选项 A 是架构任务，不应塞进 v1.2.2 债务批次（与计费正交但回归面大，需独立版本承载 + 充分测试）
- 选项 C 0.5 天可交付，立刻消除"审批/凭证对主链路静默失效"的认知盲区，与 D8（guardrail）/ #7（审批）的投产意图对齐
- 选项 B 仅在 worker 已具备 MCP tool use 能力时优选，需先核实 worker.ts

## 待用户决策

1. T18b 走选项 A（治本，独立版本）/ B（MCP 桥接）/ C（止血标注）？
2. 选项 C 是否本轮先做（0.5 天，低风险）？

决策后 T18b 实现依选项展开。本诊断文档归档为决策材料，T18b 实现时回查。

---

## T18b-C 实施记录（2026-06-25，止血已交付）

**用户决策**: T18b 全量完成依次推进（C 止血 → A 治本）。本轮先做 C。

**实施**: 选项 C 止血标注 + 配置开关（非"砍默认工具"激进版）:
- `claude-agent-sdk-adapter.ts`:类头注释标注工具执行脱节风险;`ClaudeAdapterConfig` 加 `restrictToReadonlyTools?` 开关(默认 false 保持兼容);新增 `SIDE_EFFECT_TOOLS`/`READONLY_TOOLS` 常量;`parseAllowedTools(value, restrictToReadonly)` 开关开启时过滤 Bash/Write/Edit。
- `worker.ts` / `docker-worker-runner.ts`:头注释 + DEFAULT_TOOLS 标注风险(值不变,避免破坏现有无绑定工具 Agent)。

**设计权衡**: 不直接砍 DEFAULT_ALLOWED_TOOLS(会降级所有未绑定工具的 Agent),改为标注消除认知盲区(止血核心诉求)+ 开关给投产控制杠杆。投产需限制时设 `restrictToReadonlyTools=true`。

**未覆盖(留 T18b-A 治本)**:
- 显式绑定 Bash 的 Agent:allowedTools 含 Bash 传给 SDK 内置执行器,仍绕开 ToolRegistryService(审批/凭证/计费失效)。C 止血不解决此场景。
- canUseTool 审批闭环(让 #7 审批 + callLog 对主链路生效):1.5-2 天,需 CLAUDE_WORKER_E2E=1 容器验证真生效。

**验证**: tsc/eslint 全过;parseAllowedTools 默认 false 行为兼容,adapter 单测保持通过。
