# HMR 云原生声明式 Agent 平台架构设计(v1.3-v1.7 蓝图)

> 类型:设计态文档(§6.3,允许超前于代码)
> 状态:[PLANNED] 全量推理完成,待逐版实施
> 创建:2026-06-23
> 范围:把 HMR 从"代码硬编码组装"升级为"声明式 + reconcile 解耦 + 可组装 + 可观测 + 可评测"的云原生 Agent 平台,确保真实企业可用可落地

## 一、背景与问题

HMR 已完成私有化部署前置(v1.2.1)+ 知识记忆进 agent 回路(D2)。但当前架构是"代码硬编码组装":

- 对象(Agent 定义/沙箱/工具/skill)散落在 instance 表与硬编码 buildArgs
- 声明层与执行层脱节:`ResourceConfig` 声明完整但 provisioner/docker-runner 不读
- 无 desired/actual 双态、无 spec 版本化
- 无全链路 trace 串联(只 LLM 调用写孤立 span)
- eval 不接真实执行(actualOutput 是 STUB 占位)

借鉴云原生(Kubernetes)解耦分层:所有对象声明与运行解耦、可分别管理组装、可 trace 分析+效果评测。

## 二、核查结论:已有雏形 vs 缺失断层

经 2 个 agent 全量核查(2026-06-23),核心结论:

### 三个高质量雏形已存在(复用,不造轮子)

| 雏形 | 位置 | 质量 |
|------|------|------|
| `ResourceConfig` | `server/src/contexts/tenant-instance/domain/instance.ts:55-98` | CPU/内存/GPU/PVC/model/budget 声明化已完整,加 generation 即成 spec |
| trace span 模型 | `db/schema/ai-gateway.ts`(distributed_traces + ai_traces + 树构建) | 设计达 OTel 水平,buildSpanTree 已实现 |
| evaluator-engine | `eval-benchmark/evaluator-engine.ts` | rule/judge/script/hybrid 评分全真实可用 |

### 卡在同一个断层

声明式定义 → 真实执行组装 → 全链路串联,**这一层全部缺失**。汇聚点是 `harness.dispatchTask`(D2 已在此注入 RAG,模式可复用)。

### 关键脱节(最深的债)

1. **资源声明与执行脱节**:`ResourceConfig` 声明完整,但 `ContainerOrchestratorProvisioner` 不传资源、`DockerWorkerRunner` 硬编码 `--memory 2g --cpus 1.0`、workspace 是 `/tmp` 临时目录无 PVC
2. **Agent 定义散落**:agent-profile 是人格档案(非 CRD),instance 表的 resources 散落
3. **reconcile 缺位**:health-monitor 是 liveness probe + 整机 rebuild,非 spec-diff 调和;无 desiredStatus 独立字段、无 generation(spec 世代)
4. **trace 不串联**:agent 执行链路零埋点,只 LLM 调用写孤立 span,不挂 trace 树
5. **eval 不接真实执行**:actualOutput 硬编码占位,evaluator 评分基于伪数据

## 三、核心设计:云原生三精髓映射

| 云原生精髓 | Kubernetes 概念 | HMR 对应 | 演进方向 | 版本 |
|------------|-----------------|----------|----------|------|
| 声明式 spec | CRD spec | Agent 定义(散落 instance 表) | 新建 agent_definitions CRD(版本+绑定) | v1.3 |
| 声明/运行解耦 | reconcile loop | health-monitor(探活+rebuild 雏形) | 升级为 spec-diff 调和,加 desiredStatus+generation | v1.5 |
| 可组合 | 模板+引用组装 | tool/skill 定义已完备,组装层缺失 | dispatchTask 组装 allowedTools+skills | v1.4 |
| 可观测 | OTel span 全链路 | span 模型达 OTel 水平,串联缺失 | dispatchTask 开 traceId+各步骤 span | v1.6 |
| 可评测 | 质量门禁 | evaluator 真实,actualOutput 是 STUB | 注入 AgentInvoker 取真实输出 | v1.7 |

### 设计原则

1. **每版只做一件事**,复用雏形不重写,按依赖排序
2. **harness.dispatchTask 是汇聚点**:组装/trace/eval/RAG 都在此注入(D2 已开先例),保持单一注入点
3. **声明优先于执行**:新功能先建模 spec(存 DB),再接执行层,杜绝硬编码
4. **复用雏形不重写**:ResourceConfig / distributed_traces / evaluator-engine 已达生产级,演进而非新建

## 四、5 版蓝图

### v1.3 — 声明→执行下沉通路 + Agent 定义 CRD

[PLANNED]

**目标**:打通"声明层 → 执行层"脱节,让 ResourceConfig 真正生效;建立 Agent 定义 CRD。

**做什么**:
1. **Agent 定义 CRD**:新建 `agent_definitions` 表。spec 字段:`version`(世代)、`sandboxTemplate`(引用沙箱模板)、`resourceLimits`(引用 ResourceConfig)、`workspaceStrategy`(PVC/emptyDir)、`boundTools[]`、`boundSkills[]`、`modelConfig`。复用现有 ResourceConfig 结构。
2. **资源下沉**:`ContainerOrchestratorProvisioner` 传 ResourceConfig.cpu/memory;`DockerWorkerRunner` 从硬编码 `2g/1.0` 改为读 opts.resources(向后兼容:缺省用现值)。
3. **PVC 落地**:workspace 从 `/tmp/hmr-tasks/${taskId}`(task 级临时)改为 per-instance 持久目录(`${workspaceRoot}/${instanceId}`),实例删除才清理。storage.persistentVolumeSize 声明对接实际目录策略。
4. **migration**:agent_definitions 表 + instance 表加 agentDefinitionId/agentGeneration 字段(§7.2.1 规则3+4,索引)。

**不做**:reconcile(v1.5)、组装层(v1.4)、trace(v1.6)、eval(v1.7)。

**关键文件**:`db/schema/agent-definition.ts`(新)、`db/migrations`、`tenant-instance/provisioners/container-orchestrator-provisioner.ts`、`agent-core/sandbox/infrastructure/docker-worker-runner.ts`(buildArgs 读 resources)、`agent-core/sandbox/claude-agent-sdk-adapter.ts`(cwd 改 per-instance)。

**验证**:配 ResourceConfig.cpu=1000m → docker run 参数含 `--cpus` 对应值;实例 workspace 跨 task 持久;CRUD agent_definition。

### v1.4 — 可组装层(沙箱模板 + 工具/skill 自动组装)

[PLANNED] 依赖 v1.3

**目标**:agent 执行时按 Agent 定义自动组装 allowedTools+skills,而非调用方手填;沙箱模板化。

**做什么**:
1. **沙箱模板**:buildArgs 抽成 `SandboxTemplateConfig`(image/resourceOverrides/network/capabilities/security),按 agent 定义引用。多模板可选(基础/高权限/网络隔离)。
2. **工具自动组装**:dispatchTask 前,按 agentDefinition.boundTools 查 tool-management 的 ToolDefinition,组装成 allowedTools 注入 task.input(替代调用方手填)。
3. **skill 组装**:按 agentDefinition.boundSkills 查 AssetBinding,组装进 prompt(类似 D2 的 ragContext 注入,扩展为 skillsContext)。
4. **复用 D2 模式**:IRagContextProvider 的 port 接口模式 → 扩展为 IAssemblyProvider(组装工具+skill+ragContext 统一注入点)。

**关键文件**:`agent-core/domain/assembly-provider.ts`(新,扩展 D2 模式)、`harness.ts`、`shared-assets/skill-service`、`tool-management/tool-management-service`。

**验证**:Agent 定义绑定 3 工具+2 skill → dispatchTask 后 task.input.allowedTools 含这 3 个、prompt 含 skill 块。

### v1.5 — 声明/运行 reconcile 解耦

[PLANNED] 依赖 v1.3

**目标**:声明态 vs 运行态真正分离,health-monitor 升级为 spec-diff 调和。

**做什么**:
1. **desiredStatus + generation**:instance 表加 `desiredState`(期望)与现有 `state`(实际)并列;加 `generation`(spec 世代,区别于乐观锁 version)。
2. **reconcile controller**:新 scheduler handler(每 N 秒),对比 desiredState vs state + spec generation diff。差异调和:CPU 调整只扩容不重建、状态漂移按 desired 拉齐。复用 CompositeProvisioner 加 `reconcile(instance, desired)` 方法。
3. **health-monitor 升级**:从"state 字符串对比+整机 rebuild"升级为"spec diff + 增量调和"。

**关键文件**:`db/schema/instance.ts`(加字段+migration)、`scheduler/handlers/instance-reconciler.ts`(新)、`tenant-instance/provisioners`(IInstanceProvisioner 加 reconcile)。

**验证**:改 desiredState=stopped → reconciler 调 teardown;调 ResourceConfig.cpu → 扩容不重建。

### v1.6 — 全链路 trace 闭环

[PLANNED] 独立(可与 v1.4/v1.5 并行)

**目标**:一个 agent 任务从 dispatch 到完成,全链路 trace 串联(RAG 召回/sandbox dispatch/docker-worker/LLM/工具执行同 traceId)。

**做什么**:
1. **dispatchTask 开 trace**:Harness.dispatchTask 入口生成 traceId,写 distributed_traces 根 span。
2. **各步骤开 span**:RAG 召回、adapter.submitTask、docker-worker 子进程、LLM 调用、工具执行各开 child span,回填 parentSpanId/distTraceId。
3. **复用现有模型**:直接用 distributed_traces + ai_traces + buildSpanTree,不新建 trace 体系。把现有孤立 LLM span 挂到 agent trace 树。
4. **trace 查询 API**:按 taskId 查完整 span 树(前端可可视化)。

**关键文件**:`agent-core/harness/harness.ts`(开 trace)、各步骤埋点、`observability/distributed-trace-service`、`routes/admin/ai-gateway.ts`(trace 查询)。

**验证**:dispatch 一个任务 → 查 traceId 得到完整 span 树(dispatch→rag→sandbox→worker→llm→tool)。

### v1.7 — eval 评测真实化

[PLANNED] 依赖 v1.4(真实组装)

**目标**:eval 接真实 Agent 执行,actualOutput 不再是 STUB,激活 trajectory 评测。

**做什么**:
1. **注入 AgentInvoker**:EvalService 构造器加 AgentInvoker(`scheduler/agent-invoker.ts` 已定义接口)。
2. **actualOutput 采集**:evaluateCaseWithEvaluators 里 `await agentInvoker.invoke({instanceId, prompt})` 取 conclusion 作 actualOutput,替换占位串。
3. **toolCallsLog 采集**:agent 执行回传 outputPayload.toolCalls,填 CaseEvalContext 激活 trajectory 类评测。
4. **复用 v1.4 组装**:eval 触发的 agent 执行走 v1.4 的组装层(绑定工具/skill),评测的是真实组装后行为。
5. **质量门禁**:eval verdict 可作为 agent 版本发布的质量门禁(spec generation 升级前过 eval)。

**关键文件**:`eval-benchmark/eval-service.ts`(注入 AgentInvoker + 替换 actualOutput)、`eval-benchmark/evaluator-engine.ts`(零改动)、`agent-invoker` 回传 toolCalls。

**验证**:跑 eval case → actualOutput 是真实 agent 产出;trajectory 评测命中真实工具调用序列。

## 五、实施顺序(依赖排序)

```
v1.3(声明下沉+CRD)─┬─→ v1.4(组装)──→ v1.7(eval)
                    └─→ v1.5(reconcile)
v1.6(trace)─── 独立,可与 v1.4/v1.5 并行
```

- v1.6 不依赖组装/reconcile,可提前并行
- v1.7 依赖 v1.4 的真实组装(eval 要测真实行为)

## 六、跨版本约束

1. **harness.dispatchTask 是汇聚点**:组装/trace/eval/RAG 都在此注入(D2 已开先例),保持单一注入点,避免散落
2. **声明优先于执行**:新功能先建模 spec(存 DB),再接执行层,杜绝硬编码
3. **复用雏形不重写**:ResourceConfig / distributed_traces / evaluator-engine 已达生产级,演进而非新建
4. **每版独立可交付+门禁**:每版完成跑 §14 门禁,不跨版积累未验证改动
5. **migration 随 schema**:每个新表/加列同步 .ts migration(§7.2.1 规则3,记忆 migrate.ts 不跑 .sql)

## 七、验证方式(整体)

- 每版三重门禁:tsc / eslint / vitest 全绿
- v1.3:docker run 参数读 ResourceConfig + workspace per-instance 持久
- v1.4:Agent 定义绑定工具/skill → dispatchTask 自动组装
- v1.5:desiredState 变更 → reconciler 调和,spec diff 增量而非整机重建
- v1.6:taskId 查 trace 得完整 span 树
- v1.7:eval actualOutput 是真实 agent 产出,trajectory 评测命中真实 toolCalls

## 八、版本管理处置

- v1.2.2(计费)退回 backlog(用户决策:内部推广暂不计费)
- v1.3-v1.7 云原生解耦为新路线,v1.3 接为 current
- 各版本实施时创建对应 `docs/versions/vX.Y.Z-current.md`
- 本设计文档是 5 版总纲,各 current.md 引用本文件作为架构依据
