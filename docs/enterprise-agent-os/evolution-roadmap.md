> ⚠️ **历史文档快照**（非当前实现）：本文档为早期架构/规划/PRD 记录，部分内容已被后续演进取代。当前实现以 `server/src` + `client-suite/apps/web/src` 代码为准（28 个限界上下文 · Hono/TS/Drizzle · PostgreSQL@5435）。

# HMR → Enterprise Agent OS 渐进式演进地图

> 从现有代码到愿景的桥梁——不是重写，是进化。
> 2026-05-04 制定

---

## 演进总纲

### 三条铁律

1. **每一步都要产出可感知的用户价值** — 不是技术重构，是产品进化
2. **前一阶段的输出是后一阶段的输入** — 没有执行数据就不碰感知回路
3. **现有代码只做增量演进** — DecisionHub 不重写，在其上生长

### 全局时间线

```
Phase 1          Phase 2              Phase 3           Phase 4
人机判断界面       编排层智能化           分层目标体系         感知回路+知识沉淀
成熟化            + Task Contract       + 战略解码          
                                                        
4-6 周            6-8 周               4-6 周             8-12 周
├────────────────┼────────────────────┼──────────────────┼──────────────────┤
     ↑                  ↑                   ↑                  ↑
 可立即启动        判断界面可用         编排层可按契约调度   有足够执行数据积累
```

---

## Phase 1：人机判断界面成熟化

> **目标**：让 DecisionHub 从"能演示"进化到"能用"。
> **对应愿景子系统**：人机判断界面（Human Judgment Interface）
> **时间**：4-6 周

### 为什么先做这个

1. 现有代码基础最好 — `DecisionHub` + `DecisionRequest` + 5 种触发源 + accept/modify/decline/defer 全生命周期已就绪
2. 用户价值最直接 — "问题来找人，而不是人去找问题"是最容易感知的体验升级
3. 是后续所有阶段的基础 — 编排层的异常升级、目标体系的判断节点、感知回路的信号路由，都依赖成熟的判断界面

### 核心交付

| 交付物 | 现有基础 | 需要做的 |
|--------|---------|---------|
| **信号聚合视图** | `notificationStore` + `DecisionRequest` 分散管理 | 统一信号优先级排序引擎：按 urgency × deadline × 影响范围计算权重，单一视图展示 |
| **主动推送机制** | `DecisionHub.trigger()` 只做事件发布 | 增加推送策略层：critical 即时推送 + high 聚合后推送 + normal 进入待处理队列 |
| **纠偏传播引擎** | `CollaborationChain.advanceNode()` 只影响单链 | 实现纠偏扩散图：人做出决策后，自动识别受影响的下游 Agent/任务/目标，批量更新状态 |
| **判断质量追踪** | 不存在 | 新增 `JudgmentRecord` 域模型：记录每次人工判断的输入、决策、后续结果，为 Phase 4 考核提供数据 |

### 关键代码变更

```
client-suite/apps/web/src/
  domain/
    agent/
      DecisionHub.ts           — 增加推送策略层（PushPolicy 接口）
      DecisionRequest.ts       — 增加 impactScope 字段（影响范围）
      JudgmentRecord.ts        — 【新建】判断记录实体
      SignalPrioritizer.ts     — 【新建】信号优先级计算服务
    notification/
      SignalAggregator.ts      — 【新建】跨来源信号聚合
  application/
    stores/
      decisionStore.ts         — 【新建或从 notificationStore 拆出】统一决策状态管理
    hooks/
      useDecisionQueue.ts      — 【新建】判断工作台数据 hook
  presentation/
    features/
      judgment/                — 【新建】判断工作台页面
        JudgmentWorkbench.tsx  — 主视图：待判断队列 + 信号流
        DecisionCard.tsx       — 单个决策卡片（含推荐方案对比）
        CorrectionPropagation.tsx — 纠偏影响范围可视化
```

### 验收标准

- [ ] 决策请求按优先级自动排序，critical 决策在 3 秒内推送到界面
- [ ] 人做出 accept/decline/modify 后，下游受影响的任务/Agent 状态自动更新
- [ ] 每次判断生成 `JudgmentRecord`，含完整的决策上下文快照

---

## Phase 2：编排层智能化 + Task Contract

> **目标**：让 Agent 编排从"静态配置"进化到"动态智能路由"。
> **对应愿景子系统**：智能体编排层（Agent Orchestration Layer）+ Agent 可插拔架构
> **时间**：6-8 周
> **入口条件**：Phase 1 判断界面可用（纠偏传播可工作）

### 为什么排第二

1. Phase 1 的纠偏传播需要知道"决策影响了哪些 Agent"— 编排层的拓扑感知能力
2. Task Contract 是 Agent 可插拔的前提 — 没有标准化契约，换框架就是重写
3. 能力评分是动态路由的基础 — Phase 1 积累的 `JudgmentRecord` 提供评分数据

### 核心交付

| 交付物 | 现有基础 | 需要做的 |
|--------|---------|---------|
| **Task Contract 标准** | 无显式定义 | 新增 `TaskContract` 值对象：目标 + 输入 + 验收标准 + 约束 + 上报条件 |
| **Agent 能力注册表** | `CapabilityRegistry` + `CapabilityTemplate` | 扩展：每个 Agent 登记能力域 + 历史成功率 + 平均耗时 + 成本 |
| **动态路由引擎** | `AgentRoutingService`（静态规则） | 改造为基于能力评分的加权路由：任务类型匹配度 × 历史成功率 × 成本效率 |
| **异常升级链** | `DecisionHub` 可接收 Agent 异常 | 标准化升级路径：Agent 重试 → 降级方案 → 换 Agent → 升级给人（通过 Phase 1 判断界面） |
| **Agent 绩效跟踪** | 不存在 | 新增 `AgentPerformanceTracker`：任务完成率、验收通过率、Token 消耗、异常上报准确率 |

### 关键代码变更

```
client-suite/apps/web/src/
  domain/
    agent/
      TaskContract.ts             — 【新建】任务契约值对象
      AgentCapabilityProfile.ts   — 【新建】Agent 能力画像（扩展 CapabilityRegistry）
      AgentPerformanceTracker.ts  — 【新建】Agent 绩效追踪
      AgentRoutingService.ts      — 改造：静态规则 → 加权路由算法
      EscalationChain.ts          — 【新建】异常升级链（retry→degrade→swap→escalate）
    
src/
  contexts/
    agent-orchestration/          — 【新建后端限界上下文】
      domain/
        TaskContract.js           — Task Contract 后端模型
        AgentProfile.js           — Agent 能力/绩效持久化模型
      application/
        OrchestrationService.js   — 编排核心服务
        RoutingEngine.js          — 路由引擎
```

### 验收标准

- [ ] 所有 Agent 任务通过 TaskContract 标准接口下发，不直接调用框架 API
- [ ] 同一类型任务重复执行时，系统自动倾向历史表现更好的 Agent
- [ ] Agent 执行失败后，自动触发升级链，最终可升级到人工判断界面

---

## Phase 3：分层目标体系 + 战略解码初版

> **目标**：让目标管理从"里程碑打卡"进化到"三层目标体系"。
> **对应愿景子系统**：战略解码引擎 + 目标管理体系 + 动态人机分工
> **时间**：4-6 周
> **入口条件**：Phase 2 编排层可按 TaskContract 调度 Agent

### 为什么排第三

1. 战略解码的输出是 TaskContract — 没有 Phase 2 的契约标准，解码出来的任务无法执行
2. L1 判断目标依赖 Phase 1 的判断界面
3. L2 执行目标依赖 Phase 2 的编排层调度

### 核心交付

| 交付物 | 现有基础 | 需要做的 |
|--------|---------|---------|
| **L0 战略目标** | `UserGoal`（简单目标+里程碑） | 扩展为 `StrategicObjective`：方向 + 核心约束 + 置信度仪表盘 |
| **L1 判断目标** | 不存在 | 新增 `JudgmentObjective`：需要持续回答的关键问题，月度节奏，与判断界面联动 |
| **L2 执行目标** | 不存在（Task 层无目标绑定） | 新增 `ExecutionObjective`：即 TaskContract 的上层包装，绑定到 L1/L0 |
| **目标对齐图** | 不存在 | 可视化 L0→L1→L2 的拆解树，实时展示每层的达成置信度 |
| **战略解码初版** | 不存在 | 结构化问答流程（苏格拉底模式）：系统向老板/关键人才提问，而非直接拆解。对应冷启动 Phase 2 |
| **动态分工矩阵** | DecisionHub 静态触发 | 按确定性 × 风险二维度自动判定：高确定低风险→Agent 自主 / 低确定高风险→人主导 |

### 关键代码变更

```
client-suite/apps/web/src/
  domain/
    objective/                        — 【新建子域】
      StrategicObjective.ts           — L0 战略目标
      JudgmentObjective.ts            — L1 判断目标
      ExecutionObjective.ts           — L2 执行目标
      ObjectiveAlignmentService.ts    — 目标对齐与拆解
      ConfidenceCalculator.ts         — 置信度计算（非进度百分比）
    agent/
      HumanAgentDivisionEngine.ts     — 【新建】确定性×风险动态分工引擎
      UserGoal.ts                     — 标记 @deprecated，迁移到 objective/ 子域
  presentation/
    features/
      strategic-cockpit/              — 【新建】战略驾驶舱
        ObjectiveTree.tsx             — L0→L1→L2 目标对齐可视化
        ConfidenceDashboard.tsx       — 置信度仪表盘（替代传统进度条）
        StrategicQuestioner.tsx       — 苏格拉底式问答界面
```

### 验收标准

- [ ] 用户可输入自然语言战略意图，系统产出结构化问题清单（而非直接拆任务）
- [ ] L0→L1→L2 对齐可视化，每个节点显示置信度而非完成百分比
- [ ] 新任务自动经过确定性×风险评估，决定人机分工方式

---

## Phase 4：感知回路 + 知识沉淀

> **目标**：让系统从"被动执行"进化到"主动感知+自我学习"。
> **对应愿景子系统**：感知与反馈回路 + 组织知识沉淀层
> **时间**：8-12 周
> **入口条件**：Phase 1-3 运行 2+ 个月，产生足够的执行数据和判断记录

### 为什么排最后

1. 感知回路的输入是执行数据 — 没有 Phase 2/3 的编排和目标体系，没有数据可分析
2. 知识沉淀的素材是判断记录 — 没有 Phase 1 的 JudgmentRecord，无从沉淀
3. 这是整个体系中最难、风险最高的部分 — 放在最后允许前三个阶段验证方向

### 核心交付

| 交付物 | 现有基础 | 需要做的 |
|--------|---------|---------|
| **信号总线** | `eventBus.ts`（简单 pub/sub） | 升级为 `SignalBus`：噪声过滤 + 信号分级 + 跨 Agent 关联 + 模式检测 |
| **涌现信号检测** | 不存在 | 跨 Agent 异常模式聚合：当 3+ 个 Agent 在不同任务中遇到类似阻力 → 生成系统级预警 |
| **战略假设验证** | 不存在 | 自动对比 L0 目标的初始假设 vs 实际执行数据，生成偏差报告 |
| **决策模式沉淀** | 不存在 | 从 JudgmentRecord 中提取可复用的判断模式（什么情境 + 什么决策 + 什么结果） |
| **组织学习引擎** | 不存在 | 下一轮战略拆解时，基于历史模式给出更准确的初始方案 |
| **双轨考核仪表盘** | 不存在 | Agent 绩效看板（Phase 2 数据）+ 人的判断质量看板（Phase 1 数据） |

### 关键代码变更

```
client-suite/apps/web/src/
  domain/
    sensing/                          — 【新建子域】
      SignalBus.ts                    — 智能信号总线（替代 eventBus）
      SignalCorrelator.ts             — 跨 Agent 信号关联
      PatternDetector.ts              — 异常模式检测
      EmergentSignal.ts               — 涌现信号实体
    knowledge/
      DecisionPattern.ts              — 【新建】决策模式实体（非文档）
      OrganizationalMemory.ts         — 【新建】组织记忆服务
    evaluation/                       — 【新建子域】
      AgentScorecard.ts               — Agent 绩效评估
      HumanJudgmentScorecard.ts       — 人的判断质量评估
      DualTrackEvaluator.ts           — 双轨考核引擎

src/
  contexts/
    sensing-feedback/                 — 【新建后端限界上下文】
      domain/
        Signal.js                     — 信号实体
        Pattern.js                    — 模式实体
      application/
        SignalProcessingService.js    — 信号处理管道
        PatternDetectionService.js    — 模式检测服务
```

### 验收标准

- [ ] 3+ Agent 并发报告类似异常时，系统在 5 分钟内聚合为一条系统级信号并推送给人
- [ ] 系统可展示"某类判断在过去 N 次中的准确率"，辅助人在类似情境下决策
- [ ] 战略目标设定时，系统基于历史数据给出置信度预估和关键风险提示

---

## 跨阶段：数据接入层

> 不作为独立阶段，而是贯穿 Phase 1-4 的持续工作。

### 原则

按照 Enterprise Agent OS 文档的判断：**连接器是脏活累活，不是核心壁垒。复用开源 + 自建适配。**

### 演进策略

| 阶段 | 新增连接器 | 驱动力 |
|------|-----------|--------|
| Phase 1 | 无新增（Matrix + WeKnora 够用） | 判断界面不依赖新数据源 |
| Phase 2 | 接入 1-2 个任务管理工具（Jira/Linear） | 编排层需要外部任务状态同步 |
| Phase 3 | 接入 IM 语义分析（飞书/钉钉） | 战略解码需要一线信号 |
| Phase 4 | 接入 CRM/ERP/代码仓库 | 感知回路需要全域数据 |

### 技术方案

```
src/
  infrastructure/
    connectors/                     — 【新建】
      ConnectorInterface.js         — 统一连接器接口
      JiraConnector.js              — Jira 适配
      FeishuConnector.js            — 飞书适配
      ...                           — 按需新增
```

---

## 依赖关系总图

```
Phase 1: 人机判断界面
  ├── 产出 → JudgmentRecord（Phase 4 知识沉淀的输入）
  ├── 产出 → 纠偏传播机制（Phase 2 异常升级的出口）
  └── 产出 → 推送策略层（Phase 3 L1 判断目标的载体）

Phase 2: 编排层智能化
  ├── 依赖 ← Phase 1 判断界面（异常升级的终点）
  ├── 产出 → TaskContract 标准（Phase 3 战略解码的输出格式）
  ├── 产出 → Agent 绩效数据（Phase 4 双轨考核的输入）
  └── 产出 → 动态路由（Phase 3 L2 执行目标的调度基础）

Phase 3: 分层目标体系
  ├── 依赖 ← Phase 1 判断界面（L1 判断节点载体）
  ├── 依赖 ← Phase 2 编排层（L2 执行目标的 TaskContract）
  ├── 产出 → 战略假设（Phase 4 假设验证的输入）
  └── 产出 → 目标拆解树（Phase 4 偏差分析的基准）

Phase 4: 感知回路 + 知识沉淀
  ├── 依赖 ← Phase 1 JudgmentRecord
  ├── 依赖 ← Phase 2 Agent 绩效数据
  ├── 依赖 ← Phase 3 战略假设 + 执行数据
  └── 产出 → 反哺 Phase 1-3（更智能的信号过滤、更准确的路由、更靠谱的拆解）
```

---

## 风险登记簿

| 风险 | 概率 | 影响 | 缓解策略 |
|------|------|------|---------|
| 感知回路做不出来 | 中高 | 高 — 是整个OS的神经系统 | 先做规则驱动的简单版（if-then 模式检测），不一上来就追求 AI 语义理解 |
| 战略解码过于依赖 LLM 质量 | 中 | 中 — 解码不准用户会失去信任 | 坚持"苏格拉底模式"：系统提问而非直接拆解，降低对 LLM 准确性的依赖 |
| 数据接入层连接器做不完 | 高 | 低 — 连接器不是核心壁垒 | 每阶段只接最必要的 1-2 个，复用 Airbyte 等开源方案 |
| 前端域模型爆炸 | 中 | 中 — domain/ 文件数翻倍 | 严格按子域拆分（agent/objective/sensing/evaluation），保持 DDD 边界 |
| 后端限界上下文膨胀 | 中 | 中 — 现有 7 个上下文已不少 | Phase 2/4 各新增 1 个上下文，总计 9 个，仍在可控范围 |

---

## 决策记录

| 日期 | 决策 | 原因 |
|------|------|------|
| 2026-05-04 | 渐进式四阶段演进，不并行铺开 | 复杂度管理 + 每阶段可独立验证价值 |
| 2026-05-04 | Phase 1 优先做判断界面而非编排层 | DecisionHub 基础最好 + 用户价值最直接 |
| 2026-05-04 | 感知回路放最后 | 无执行数据则无输入 + 风险最高 |
| 2026-05-04 | 战略解码采用苏格拉底模式 | 降低对 LLM 准确性的依赖 + 符合冷启动 Phase 2 理念 |
| 2026-05-04 | 数据接入层不作为独立阶段 | 脏活累活不是壁垒，按需增量接入 |
