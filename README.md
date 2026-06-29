# HMR — 企业决策指挥运行时

> Enterprise Runtime for Human-Agent Collaborative Decision Making

HMR（Human-Machine Runtime，人机运行时）是面向**央国企及中大型企业知识工作者**的决策指挥运行时。它不是 IM，不是 Agent 框架，不是项目管理工具——而是坐在这些之上的**中间层操作系统**：聚合多渠道消息、AI 智能分拣、人机协同决策、命令下达到执行闭环追踪。

---

## 为什么是 HMR

### 核心差异化

| 卖点 | 说明 |
|------|------|
| **跨平台政治护城河** | 钉钉不会帮你聚合飞书消息，飞书不会帮你聚合企微——只有中立第三方能做跨 IM 聚合。这不是技术壁垒，是政治壁垒 |
| **三层解耦架构** | Agent 框架可换（Cockpit/Dify/Coze）、渠道可换（钉钉/飞书/企微/Matrix）——运行时层消息归一化+决策引擎+执行编排不可替代 |
| **运行时即价值** | 不造 Agent，只调度 Agent；不替代 IM，只聚合 IM。做的是"信息到决策"的运行时，类比 Harness 做"代码到生产"的运行时 |
| **效果付费** | 不要求企业采购。IM 内免费装"决策助理"，按决策闭环次数收费。零迁移成本，零采购门槛 |

### 不是什么

| 容易混淆的 | HMR 的区别 |
|-----------|-----------|
| 又一个 IM | 不承载日常聊天，只处理需要注意力的高价值信号 |
| 又一个 Agent 平台 | 不构建 Agent，只调度和指挥 Agent（类比：工厂造兵，HMR 是司令部调兵） |
| 又一个项目管理工具 | 不管任务拆解，只管决策→执行→回执的闭环 |
| 某个 IM 的插件 | 跨所有 IM 的上层运行时，不依附任何单一平台 |

> 完整架构（接入解耦四面体 / Agent 执行流水线 / DDD 限界上下文）见下文 [系统架构](#系统架构)。产品战略详见 [产品战略白皮书](docs/product-strategy-command-center.md)。

---

## 快速开始

### 前置条件

- Node.js >= 20
- npm >= 10
- Docker & Docker Compose（用于 PostgreSQL）

### 启动步骤

```bash
# 1. 启动基础设施（PostgreSQL 16，端口 5435）
docker compose up -d postgres

# 2. 安装依赖
npm install
cd server && npm install && cd ..
cd client-suite/apps/web && npm install && cd ../../..

# 3. 配置环境变量
cd server && cp .env.example .env   # 按需编辑
cd ..

#    可选:轻应用预览依赖 OpenSandbox(容器隔离代码沙箱)。不配则轻应用创建可用、预览不可用。
#    需启动 OpenSandbox 服务(uvx opensandbox-server,默认 localhost:8080)并在 .env 配:
#      OPENSANDBOX_DOMAIN=localhost:8080
#      OPENSANDBOX_API_KEY=<your-key>
#      OPENSANDBOX_IMAGE=node:22-alpine

# 4. 初始化数据库（建表 + 种子数据）
npm run db:setup

# 5. 启动后端（dev 模式，热重载）
npm run dev

# 6. 启动前端（另开终端）
cd client-suite/apps/web && npx vite
```

### 访问入口

| 角色       | 入口         | URL                          | 说明                                 |
| ---------- | ------------ | ---------------------------- | ------------------------------------ |
| 终端用户   | 用户端 SPA   | http://127.0.0.1:5176/       | React SPA，消息/知识库/决策/Agent 等 |
| 租户管理员 | 管理后台 SPA | http://127.0.0.1:5176/admin  | 员工/技能/AI Gateway/配额/日志       |
| 平台运营方 | 运营平台 SPA | http://127.0.0.1:5176/ops    | 跨租户管理/监控/审计/配置            |
| 运维/开发  | 健康检查     | http://127.0.0.1:3002/health | 分级健康状态                         |
| 运维/开发  | API 服务     | http://127.0.0.1:3002/       | Hono 后端                            |

> 前端 Vite 开发服务器自动代理 `/api` → 后端 3002，`/_matrix` → Conduit 6167。

---

## 系统架构

HMR 架构从三个视角描述，互补不重复：

- **接入解耦四面体**：Agent 框架 / 渠道可插拔，HMR Runtime 核心不可替代（产品定位视角）。
- **Agent 执行流水线（v2.0）**：Agent 从声明态定义 → 发布编译固化 → 运行时读取固化产物执行（执行侧视角）。
- **DDD 限界上下文**：29 个限界上下文的代码组织（实现视角）。

### 接入解耦四面体

```mermaid
graph TB
  subgraph ControlPlane["Control Plane"]
    Auth["认证 (JWT + SSO)"]
    Tenant["租户管理"]
    Lifecycle["实例生命周期"]
    Audit["审计日志"]
  end

  subgraph RuntimePlane["Runtime Plane"]
    direction LR
    Adapter["AgentRuntimeAdapter"]
    OC2["Cockpit (默认)"]
    Other["Dify / Coze / 自研"]
    Adapter --- OC2 & Other
  end

  subgraph AssetPlane["Asset Plane"]
    Skills["技能注册"]
    Tools["工具资产"]
    KB["知识库"]
    Share["跨租户共享 + 绑定"]
    Skills & Tools & KB --> Share
  end

  subgraph ChannelPlane["Channel Plane"]
    direction LR
    ChAdapter["ChannelAdapter"]
    MX["Matrix (默认)"]
    IM["WPS / 钉钉 / 飞书"]
    ChAdapter --- MX & IM
  end

  ControlPlane <--> RuntimePlane
  ControlPlane <--> AssetPlane
  RuntimePlane <--> ChannelPlane

  style ControlPlane fill:#e8f0fe,stroke:#007AFF,stroke-width:2px
  style RuntimePlane fill:#fef3e2,stroke:#ff9500,stroke-width:2px
  style AssetPlane fill:#e8fae8,stroke:#34c759,stroke-width:2px
  style ChannelPlane fill:#f3e8fe,stroke:#af52de,stroke-width:2px
```

### Agent 执行流水线（v2.0）

Agent 从声明态定义到运行时执行的三段流水线，使线上 Agent 行为可锁定 / 审计 / 回滚（区别于"接入解耦四面体"的可插拔视角，本节是**执行侧**视角）。

```mermaid
graph LR
  subgraph L1["声明层"]
    Spec["AgentDefinitionSpec<br/>(CRD: persona/guardrails/<br/>boundTools/boundKnowledge/<br/>runtime/ragRecallPolicy)"]
  end
  subgraph L2["编译固化层"]
    Bake["BakingService.bake"]
    Manifest["RuntimeManifest<br/>(不可变: compiledSystemPrompt<br/>/tools/skills/quota)"]
  end
  subgraph L3["运行时层"]
    Harness["harness.dispatchTask"]
    Asm["(降级) assemble + getPersona"]
    Loop["tool-loop 多轮<br/>LLM 调工具"]
    Sbx["沙箱执行器<br/>(写文件/读文件)"]
  end
  Spec -->|发布| Bake --> Manifest
  Manifest -->|读 manifest 命中| Harness
  Harness -.未 bake/灰度.-> Asm
  Harness --> Loop --> Sbx
  style L2 fill:#fff3cd,stroke:#ffc107,stroke-width:2px
  style Sbx fill:#e8fae8,stroke:#34c759
```

- **声明层**：`AgentDefinitionSpec` 是云原生 CRD 式声明态定义，包含人设/拒答规则/绑定工具技能知识库/运行时类型/RAG 召回策略等。声明不绑定实例——一个 AgentDefinition 可被 0~N 个数字员工实例引用（`instance.agentDefinitionId` 可空）。
- **编译固化层**：Agent 发布时 `bake` 成不可变 `RuntimeManifest`（落 `agent_runtime_manifests` 表），固化 systemPrompt/tools/skills/quota 快照。spec 变更 → bumpGeneration → re-bake 新 manifest，旧 instance 引用旧 generation（灰度/回滚）。
- **运行时层**：`harness.dispatchTask` 优先读 baked manifest（命中则跳过动态查 DB 拼装，消除运行时漂移），未 bake 的存量 Agent降级走 assemble + getPersona 老路径（灰度兼容）。
- **沙箱执行**：dispatchTask 经 `tool-loop` adapter 驱动 LLM 多轮调工具（write_file/read_file/list_files），工具调用经 `registry.invoke` → `executor-factory` 路由到**沙箱执行器**——LLM 写的文件落沙箱工作区，轻应用预览就在此沙箱内 npm install + vite dev。沙箱后端按配置选（见下）。

#### 沙箱后端选型

`executor-factory` 按 `OPENSANDBOX_DOMAIN` 是否配置选择沙箱后端：

| 后端 | 隔离强度 | 触发条件 | 状态 |
|------|----------|----------|------|
| **OpenSandbox**（docker 容器） | 容器隔离（投产推荐） | `.env` 配 `OPENSANDBOX_DOMAIN` | `[已落地]` |
| **node-fs**（`SandboxExecutor`） | 无隔离（仅开发，路径校验防护但不防逃逸） | 未配 `OPENSANDBOX_DOMAIN` 时降级 | `[已落地]` |
| **CubeSandbox**（KVM MicroVM） | microVM 强隔离（高安全场景） | sandboxTemplate=`kvm-microvm`（SandboxRouter 路由） | `[待 KVM 宿主]` |

OpenSandbox：每个 callerId（实例/任务）复用一个 docker 容器（缓存 + TTL 空闲清理），容器内 `/workspace` 为应用工作区。CubeSandbox 是规划的高安全后端，与 OpenSandbox 并存（SandboxRouter 按策略路由），代码接 E2B SDK，待 KVM 宿主可实测。

> **实现状态**：baking 编译固化链路 `[已落地]`；OpenSandbox 沙箱执行 `[已落地]`；CubeSandbox（KVM MicroVM）高安全执行层 `[待 KVM 宿主]`。详见 [v2.0 设计文档](docs/architecture/v2.0-declarative-baking-runtime.md)，进度见 [v2.0-current](docs/versions/v2.0-current.md)。

### DDD 限界上下文（29 个）

```mermaid
graph LR
  subgraph Core["核心域"]
    TM["tenant-management"]
    TI["tenant-instance"]
    IA["identity-access"]
    QM["quota-management"]
  end

  subgraph Business["业务域"]
    AC["agent-core"]
    RE["runtime-engine"]
    SA["shared-assets"]
    CH["channel"]
    DOC["document"]
    KN["knowledge"]
    WS["workspace"]
    MK["marketplace"]
    AN["analytics"]
  end

  subgraph Support["支撑域"]
    AO["audit-observability"]
    GW["gateway"]
    NT["notification"]
    OB["observability"]
  end

  IA --> TM & TI
  TM --> TI
  QM --> TM
  RE --> CH & AC

  style Core fill:#e8f0fe,stroke:#007AFF
  style Business fill:#fef3e2,stroke:#ff9500
  style Support fill:#f8f9fa,stroke:#dee2e6
```

### 多租户模型

| 域 | 角色 | JWT scope | 数据隔离 |
|----|------|-----------|---------|
| Platform | 平台管理员、运维 | `platform` | 全局可见 |
| Tenant | 租户管理员、运维、审计员 | `tenant` | `tenantId` 强制过滤 |

配额四维度：容量（实例/并发/用户）、资源（CPU/内存/存储）、AI（Token/调用/速率）、数据（保留期/Webhook/知识库）。

---

## Enterprise Agent OS

HMR 用户端内置五大子系统，构成完整的 Agent 指挥操作系统：

| 子系统 | 功能 | 前端入口 | 后端路由 |
|--------|------|----------|----------|
| **战略驾驶舱** | 目标树、信心度仪表盘、战略提问器、部门矩阵 | `strategic-cockpit` | `/api/cockpit/objectives` |
| **编排中心** | 协作链管理、Agent 调度、升维时间线 | `orchestration` | `/api/cockpit/orchestration/*` |
| **感知反馈** | 信号雷达、模式识别、紧急信号检测 | `sensing` | `/api/cockpit/signals/*` |
| **考核评估** | 人机双轨仪表盘、趋势分析、记分卡 | `evaluation` | `/api/cockpit/evaluation/*` |
| **判断推理** | 判断工作台、信号时间线、修正图谱 | `judgment` | `/api/cockpit/decisions/*` |

> **v2.1 EAOS domain 实体化**：五子系统（感知/战略解码/判断/编排/评估）已从 `cockpit_entities` EAV 通用单表（弱类型 jsonb、无实体不变式）抽为各自独立实体表 + 带 `contexts/cockpit/domain/` 的 immutable DDD 实体（枚举校验/值对象/状态机）+ repository（filter 下推 DB）+ application service（route 下沉薄层，守 §12信号6）。对外 API 契约与前端 DTO 不变（破贫血为内部架构重构）。dual-track 评估洞察与战略解码 `/decode` 接真 LLM（经 LiteLLM，未配置返空不回退硬编码）。

---

## 核心运行时引擎

| 引擎 | 职责 | 位置 |
|------|------|------|
| **MessageNormalizer** | 多渠道消息归一化：意图分类、紧急度评估、实体抽取 | `contexts/runtime-engine/` |
| **PriorityScorer** | 多因子优先级评分（意图×紧急度×发送者权重×时效性） | `contexts/runtime-engine/` |
| **DedupEngine** | 跨渠道消息去重（Jaro-Winkler 相似度 + 指纹哈希） | `contexts/runtime-engine/` |
| **RecommendationEngine** | 决策建议生成（历史模式匹配 + 多源上下文聚合） | `contexts/runtime-engine/` |
| **ReceiptManager** | 执行回执路由（成功/失败/进度回传到原始渠道） | `contexts/runtime-engine/` |

---

## 功能概览

### 用户端 SPA（index.html）

基于 Dock 导航注册 15 个功能面板：

| 面板 | 路由 key | 说明 |
|------|----------|------|
| 消息 | messages | IM 收发 + 回复/编辑/撤回/通话 |
| 轻应用 | apps | 对话式创建应用（LLM 经 tool-loop 真实写文件到 sandbox）+ 文件树/预览 |
| 通讯录 | contacts | 联系人管理 |
| 知识库 | knowledge | 文档/知识库管理 |
| 待办 | tasks | 任务管理 |
| 通知 | notifications | 通知中心 |
| 日历 | calendar | 日程管理 |
| 动态 | subscription | 信息流订阅 |
| 工作面板 | cockpit | 决策中心（任务/信号/协作/渠道） |
| Agent | agents | Agent Hub + 详情/配置 |
| 战略 | strategic-cockpit | Enterprise Agent OS · 战略驾驶舱 |
| 编排 | orchestration | Enterprise Agent OS · 编排中心 |
| 感知 | sensing | Enterprise Agent OS · 感知反馈 |
| 考核 | evaluation | Enterprise Agent OS · 考核评估 |
| 判断 | judgment | Enterprise Agent OS · 判断推理 |

### 管理后台（admin.html）

| 模块 | 说明 |
|------|------|
| 运营数据 | Cockpit 统计概览 + 运行监控 |
| 员工管理 | 数字员工 CRUD + 详情/编辑/资源/话题 |
| 共享 Agent | 跨租户共享 Agent 注册/绑定 |
| 技能管理 | 技能详情 + 策略配置 |
| 工具管理 | 工具资产管理 + 风险等级 |
| AI Gateway | 模型路由/调用追踪/成本分析/风控规则 |
| 配额管理 | 配额仪表盘/分配/告警 |
| 编译固化 | bake 触发/manifest 查看/版本对比/回滚（v2.0） |
| 投产管控 | 工具审批队列 + Feature Flag 灰度 + 运行时模板（v1.9） |
| 凭证保险库 | 加密存储 + 租约（工具调用解密） |
| 数字员工记忆 | mem0 记忆 store 管理 |
| AI 助手 | 管理后台 AI 分析助手 |
| 用户分析 | 用户行为分析 |
| 通知/日志 | 系统通知 + 行为日志筛选 |
| 账号权限 | 租户内用户与角色管理 |

### 运营平台（ops.html）

| 模块 | 说明 |
|------|------|
| 租户管理 | 创建/编辑/暂停/激活 + 配额 |
| 平台用户 | 平台域用户 CRUD |
| 角色管理 | 平台角色管理 |
| 全局配置 | 运行时参数编辑 |
| 运营监控 | 资源总览 + 健康状态 |
| 审计日志 | 跨租户操作审计 |

---

## 企业接入：替换为自有系统

HMR 的所有外部对接均通过 `server/src/contexts/gateway/clients/` 下的标准 HTTP 客户端隔离，企业可按需将下列组件替换为自有同类系统，无需改动 HMR 核心代码。各组件均通过环境变量配置接入地址。

| 组件 | 业务职责 | 接入方式（环境变量） | 企业可替换为 |
|---------|---------|---------------------|-------------|
| **技能市场** | Skill/Agent 市场生态：技能列表、安装、Agent 目录 | REST API `MARKETPLACE_API_URL` | 企业内部技能/Agent 市场、Dify 市场、自建插件仓库 |
| **配置中心** | Agent Profile/Journey、画像与成长档案 | REST API `PROFILE_SERVICE_API_URL` | 企业配置中心、CMDB、自建 Agent 档案系统 |
| **AI 工作区** | Workspace/App/Agent 创建与编排 | REST API `WORKSPACE_BACKEND_API_URL` | Coze、Dify、自建 AI 应用生成平台 |
| **实例编排** | K8s 实例编排、消息网关、Channel Bridge | REST API `CONTAINER_ORCHESTRATOR_API_URL` + K8s API | 企业自有编排平台、消息网关 |
| **平台后端** | 企业 OAuth + 凭证托管 | REST API `PLATFORM_BE_API_URL` | 企业统一身份/凭证服务 |
| **实例管理** | 数字员工实例数据源 | REST API `CLUSTER_INSTANCE_API_URL` | 企业实例管理服务 |

> 组件代号为业务语义中性命名（不再绑定上游品牌）；未配置时各客户端降级兜底，不阻断 HMR 核心运行。完整环境变量见 `server/.env.example`。

**LLM 供应商隔离**：所有大模型调用统一经 **LiteLLM** 中转，数字员工与上层业务不直接耦合具体供应商（Anthropic/OpenAI/通义/智谱等）。企业更换或新增模型供应商时，仅需在 LiteLLM 侧配置，HMR 调用链路无感切换。

**渠道（Channel）可插拔**：IM 接入遵循 `IChannelAdapter` 标准接口，Matrix 为默认实现，企业可接入钉钉/飞书/企微/邮件等渠道，每种渠道独立开关。

**认证（Auth）可插拔**：本地密码登录为默认通道；企业 SSO 通过 OIDC 标准协议接入任意 IdP（Entra ID、Okta、Keycloak、企业自建 OAuth 等），参数经环境变量配置。

> 架构层面的对接关系与可替换性详见 [生产化架构设计 · 十一、企业如何接入自有系统](docs/architecture/production-architecture.md)。

---

## 渠道集成

HMR 通过标准化 `IChannelAdapter` 接口接入通信渠道，`ChannelService` 统一注册和调度。

### 已实现

| 渠道 | 适配器 | 能力 |
|------|--------|------|
| **Matrix** | `MatrixChannelAdapter` | 发送/接收/房间列表/健康检测（默认实现，含后端 bot 对话闭环 T57） |
| **WebSocket** | `WebSocketChannelAdapter` | 实时推送/客户端连接管理 |
| **WPS** | `WpsChannelAdapter` | 投产默认禁用：7 方法（editMessage/redactMessage/createDmRoom/invite/createGroup/join/leave）仍为 `NotImplementedError`，需设 `VITE_WPS_IM_ENABLED=true` 显式启用（构造 fail-fast 守卫，T21） |

### 规划中

| 渠道 | 接入方式 |
|------|----------|
| 飞书 | 事件订阅 + 机器人消息 |
| 钉钉 | 事件订阅 + 机器人消息 |
| 企微 | 回调 + 应用消息 |
| 邮箱 | IMAP/SMTP |

### 接口定义

```typescript
interface IChannelAdapter {
  readonly channelType: ChannelType;
  readonly supportsInbound: boolean;
  sendMessage(target: ChannelTarget, message: ChannelMessage): Promise<void>;
  getStatus(): Promise<ChannelStatus>;
  listConversations(userId: string): Promise<ChannelConversation[]>;
  onInboundMessage?(handler: (msg: InboundMessage) => void): () => void;
}
```

---

## Agent 框架集成

通过 `IAgentRuntimeAdapter` 标准接口对接任意 Agent 框架，`AgentCore` 外观统一组合 Session(状态) / Harness(编排) / Sandbox(执行) 三层，`AdapterRegistry` 在 Sandbox 层负责 adapter 注册与路由。

### 接口定义

```typescript
interface IAgentRuntimeAdapter {
  readonly framework: AgentFramework; // 'tool-loop' | 'cockpit' | 'dify' | 'coze' | 'langchain' | 'claude-agent-sdk' | 'custom'
  submitTask(task: AgentTaskInput): Promise<{ taskId: string; accepted: boolean }>;
  getTaskStatus(taskId: string): Promise<AgentTaskStatus>;
  cancelTask(taskId: string): Promise<{ cancelled: boolean }>;
  onTaskComplete(callback: (result: AgentTaskResult) => void): () => void;
  listCapabilities(): Promise<AgentCapability[]>;
  healthCheck(): Promise<{ healthy: boolean; latencyMs: number }>;
}
```

### 已实现

| 框架 | 适配器 | 说明 |
|------|--------|------|
| **Tool-Loop** | `ToolLoopAdapter` | 主执行引擎。国产模型（经 LiteLLM）多轮工具循环执行，不被 Anthropic 协议绑定；驱动实例任务真实执行（业务工具）与沙箱内真实创建应用（coding 工具 + OpenSandbox 容器隔离）。`selectBestAdapter` 优先路由 |
| **Claude Agent SDK** | `ClaudeAgentSdkAdapter` | 真实 coding agent。在 Docker 沙箱(`claude-worker`)内通过 Claude Agent SDK 执行，支持预算熔断/会话续接/Token 用量入账。需强模型（glm-4-flash 在 SDK 19 内置工具噪声下失焦，T43 实测），未配置时降级 tool-loop |

> 早期 `OpenClawAdapter`（假桩 `simulateProgress`）已删除（T36），由 `ToolLoopAdapter` 真实执行替代。`'cockpit'` framework 枚举值保留为声明态运行时类型标识，无对应 adapter 实现。

---

## Agent 声明式创建与投产管控（v1.9）

> v1.9 投产就绪版本:Agent 声明式创建升级 + 3 项投产阻断项补全(#1 拒答/#7 审批/#13 灰度)+ D8 运行时解耦。详见 `docs/versions/v1.9-snapshot.md`。

### Agent 声明式创建向导

Agent 创建走 7 步声明式向导（`AgentCreateFlow`),声明完整 `AgentDefinitionSpec` 落库 `agent_definitions` CRD,数字员工实例通过可空 `agentDefinitionId` 关联引用(声明不绑定实例,一个 AgentDefinition 可被 0~N 个实例引用):

1. 基础信息（名称/头像/描述）
2. 人设（systemPrompt + guardrails 拒答规则 + refusalResponse）
3. 模型（primaryModel + fallbackModels + maxConcurrency）
4. 技能（boundSkills）
5. 知识（boundKnowledge,RAG 召回范围）
6. 工具（boundTools,按 riskLevel 走审批）
7. 运行时（runtimeType: claude/cockpit/hermes + sandboxTemplate）

API:`/api/admin/agent-definitions`(CRUD + 分页,admin 聚合层挂 auth + requireRole)。

### 投产阻断项补全

- **#1 任务边界/拒答**:persona.systemPrompt 软约束注入 + guardrails 硬约束拦截(keyword/regex block 直接拒答,intent review 转 LLM 复核)。实例路径 harness 注入(T3);cockpit 对话路径 useAgentChat 前端拦截 + 后端兜底。
- **#7 执行审批**:工具 riskLevel + 实例 approvalPolicy 阈值,超阈值走 `tool_approvals` 审批队列,admin approve 触发续执行。
- **#13 灰度发布**:feature flag(enabled + rolloutPct 确定性 hash 灰度 + allowedTenants 白名单 + killSwitch 紧急关停),guardrails/approval 默认 off,灰度逐步 enforce。

### D8 运行时解耦(治本)

`useAgentChat` 经 `AgentRuntimePort` 抽象调用对话后端(WeKnora/Cockpit),不再硬绑 `weKnoraApi`;persona 从 `instance → agentDefinitionId → AgentDefinition.persona` 拉取,替代 capabilityRegistry template.systemPrompt。运行时可按 `runtime.runtimeType` 替换。

### 管理后台投产管控

管理后台「投产管控」组:
- **工具审批**:pending 队列 approve/reject(`/api/admin/tool-approvals`)
- **Feature Flag**:enabled/rolloutPct/killSwitch 编辑(`/api/admin/feature-flags`)
- **运行时模板**:内置 sandbox 模板 + runtimeType→adapter 映射(只读,`/api/admin/runtime-templates`)

## API 概览

### 认证（/api/auth）

| 方法 | 路径 | 说明 |
|------|------|------|
| POST | `/api/auth/login` | 统一登录 |

### 平台运管（/api/platform）

| 方法 | 路径 | 说明 |
|------|------|------|
| GET/POST | `/api/platform/tenants` | 租户管理 |
| GET | `/api/platform/users` | 平台用户 |
| GET | `/api/platform/audits` | 审计日志 |
| GET | `/api/platform/config` | 全局配置 |
| GET | `/api/platform/monitoring/*` | 运营监控 |
| GET | `/api/platform/roles` | 角色管理 |

### 租户管理（/api/admin）

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/api/admin/employees` | 员工管理 |
| GET | `/api/admin/skills` | 技能管理 |
| GET | `/api/admin/tools` | 工具管理 |
| GET | `/api/admin/ai-gateway` | AI Gateway |
| GET | `/api/admin/analytics` | 分析统计 |
| GET | `/api/admin/logs` | 行为日志 |
| GET | `/api/admin/auth` | 账号权限 |
| GET | `/api/admin/agents/shared` | 共享 Agent |
| GET | `/api/admin/mcp` | MCP 管理 |
| POST | `/api/admin/assistant` | AI 助手 |

### 决策中心（/api/cockpit）

| 路径 | 说明 |
|------|------|
| `/api/cockpit/tasks/*` | 任务管理 |
| `/api/cockpit/decisions/*` | 决策管理 |
| `/api/cockpit/signals/*` | 信号/模式/修正 |
| `/api/cockpit/objectives/*` | 目标/战略分解 |
| `/api/cockpit/collaboration` | 协作 |
| `/api/cockpit/orchestration/*` | 编排链/升维/Agent 注册 |
| `/api/cockpit/evaluation/*` | 指标/记分卡/双轨/趋势 |
| `/api/cockpit/channels` | 渠道管理 |
| `/api/cockpit/workspace` | 工作空间 |
| `/api/cockpit/studio` | Studio 资产聚合（T13，替代假数据桩） |
| `/api/cockpit/agent/dispatch` | 轻应用对话式创建（tool-loop 真实写文件到 sandbox，T52） |
| `/api/cockpit/agent/sandbox/:id/files` | sandbox 工作区文件读取（展示 LLM 创建的代码） |
| `/api/cockpit/agent/sandbox/:id/preview` | 应用预览（sandbox 内 npm install + vite dev，返回可访问 URL） |
| `/api/cockpit/chat` | 对话能力（persona/guardrail/history + LiteLLM，cockpit chat 与 Matrix bot 共用，T57/T59） |
| `/api/cockpit/bootstrap` | 前端初始化数据 |

### 管理控制面（/api/control）

L2 控制面，需 `platform_admin` 或 `tenant_admin` 角色。

| 路径 | 说明 |
|------|------|
| `/api/control/instances` | 数字员工实例管理 |
| `/api/control/agent-definitions` | Agent 定义 CRUD + 实例化（T27） |
| `/api/control/marketplace` | 技能/Agent 安装（T20b） |
| `/api/control/quotas` | 配额管理 |
| `/api/control/departments` `/skills` `/documents` `/knowledge` | 组织/技能/文档/知识 |
| `/api/control/audits` `/knowledge-audits` | 审计 |
| `/api/control/storage` `/uploads` | 存储/上传 |
| `/api/control/app-catalog` | 应用目录 |

### MCP 服务（/api/mcp）

MCP（Model Context Protocol）服务端，对外暴露工具/资源供 Agent 调用。

### Gateway 代理（/api/proxy）

| 路径 | 上游服务 |
|------|----------|
| `/api/proxy/marketplace` | 技能市场 |
| `/api/proxy/profile` | 配置中心 |
| `/api/proxy/workspace` | AI 工作区 |
| `/api/proxy/channel` | 实例编排 |
| `/api/proxy/mcp` | MCP 服务 |

---

## 项目结构

```
human-machine-runtime/
  server/                                # Hono + TypeScript + Drizzle
    src/
      app/                               # 启动入口 + 中间件链
      config/                            # 类型化配置（环境变量）
      db/                                # Drizzle schema + migrations + seed
      shared/                            # 共享工具（newId, AppError, event-bus）
      middleware/                        # auth, cors, rate-limit, audit-trail
      routes/                            # Hono 路由注册
        platform/                        # L1 运管平台路由
        admin/                           # L2 租户管理路由
        control/                         # L2 控制面路由
        cockpit/                        # 用户端决策中心 + Enterprise Agent OS
      contexts/                          # DDD 限界上下文 ×29
        runtime-engine/                  # 核心运行时引擎（消息归一化/优先级/去重/推荐/回执）
        agent-core/                      # Agent 执行 + AgentRuntimeAdapter 接口
        channel/                         # ChannelAdapter 接口 + 适配器 + 路由 + 决策控台
        gateway/clients/                 # 12 个上游服务客户端
        identity-access/                 # JWT + SSO + RBAC
        tenant-management/               # 租户生命周期
        ...
      integrations/matrix/               # MatrixBot + NLU + Commands
  client-suite/
    apps/web/                            # React + TypeScript SPA
      index.html                         # 用户端入口
      admin.html                         # 管理后台入口
      ops.html                           # 运营平台入口
      src/
        domain/                          # 纯业务逻辑（15 子域）
        infrastructure/                  # API client + Matrix + channels
        application/                     # zustand stores + hooks + services
        presentation/                    # React 组件（24 feature 模块）
    packages/ui-tokens/                  # 设计 token
  deploy/helm/human-machine-runtime/     # 生产 Helm Chart
  deploy/                                # K8s manifests + Docker Compose + 可观测性
```

---

## 开发命令

### 根目录

```bash
npm run dev              # 启动后端（tsx watch 热重载，端口 3002）
npm run build            # 构建后端
npm start                # 启动构建产物
npm test                 # 后端测试（vitest，192 文件）
npm run lint             # ESLint
npm run type-check       # TypeScript 检查
npm run db:setup         # 数据库迁移 + 种子数据
npm run verify           # 后端 + 前端全量验证
```

### 前端（client-suite/apps/web）

```bash
npx vite                 # 启动 dev server（端口 5176）
npx vite build           # 生产构建
npx tsc --noEmit         # TypeScript 严格模式检查
npx vitest run           # 测试（103 文件）
```

### Docker Compose

```bash
docker compose up -d postgres            # PostgreSQL 16（端口 5435）
docker compose up -d redis               # Redis 7（端口 6379）
docker compose --profile weknora up -d   # WeKnora RAG 服务（端口 8088）
docker compose --profile full up -d      # 全部服务（含 Matrix Conduit）
```

### Matrix (Conduit) Bot 注册

Conduit 配置已内置在 `docker/conduit/conduit.toml`(端口 6167,`server_name=localhost`,`allow_registration=true`)。容器启动后,跑一次 bot 注册脚本生成 `runtime/matrix-bot.{token,device}`:

```bash
docker compose up -d conduit                         # 启动 Conduit
bash scripts/ensure-matrix-bot.sh                    # 注册 bot + 创建 factory room
# 默认账号 @hmr-bot:localhost / 密码 hmr-bot-changeme(可用 MATRIX_BOT_PASSWORD 覆盖)
```

脚本流程:Conduit `/register` API(无 shared secret)→ 拿 access_token/device_id → 写 `runtime/matrix-bot.{token,device}` → 设置 displayname → 创建/加入 `#hmr-factory:localhost`。已注册用户会自动 fallback 到 `/login`,脚本幂等可重复执行。

> ⚠️ `allow_registration=true` 仅供开发期 bot 注册使用,生产部署必须在 bot 注册完成后改 `false`,防止匿名注册。

---

## 技术栈

### 前端

| 项 | 选型 | 约束 |
|----|------|------|
| 框架 | React + TypeScript | 严格模式，no any |
| 样式 | Tailwind CSS 3.4 | 通过 `@hmr/ui-tokens` preset |
| 状态 | zustand | 一个 store 一个文件 |
| 设计语言 | Apple HIG glass morphism | 主色 `#007AFF` |
| 测试 | vitest | 103 文件 |

### 后端

| 项 | 选型 | 约束 |
|----|------|------|
| 运行时 | Node.js 20+ | ESM，TypeScript strict |
| 框架 | Hono | 路由薄层，中间件链式组合 |
| ORM | Drizzle | TypeScript-first，PostgreSQL |
| 数据库 | PostgreSQL 16 | 本地 5435 端口 |
| 认证 | JWT + SSO 预留 | bcrypt 密码 |
| 测试 | vitest | 192 文件 |

---

## 数据库

| 项 | 值 |
|----|-----|
| 数据库 | PostgreSQL 16 |
| ORM | Drizzle |
| 本地端口 | 5435 |
| 连接串 | `postgresql://hmr:hmr@localhost:5435/hmr` |

```bash
npm run db:setup                 # 迁移 + 种子数据（7 个默认账号）
cd server && npm run db:studio   # Drizzle Studio 数据浏览
```

### 种子账号（Production profile）

> 密码可通过 `HMR_SEED_*_PASSWORD` 环境变量注入；下表为未注入时的演示默认值（生产部署务必注入强密码）。

| 用户名 | 角色 | 密码 | 说明 |
|--------|------|------|------|
| admin | platform_admin | admin123 | 平台域管理员 |
| tenant_admin | tenant_admin | tenant123 | 租户管理员 |
| ops | tenant_ops | ops123 | 租户运维 |
| auditor | tenant_auditor | audit123 | 租户审计 |
| alice.chen | tenant_ops | — | OIDC 模拟用户（无密码） |
| bob.smith | tenant_ops | — | OIDC 模拟用户（无密码） |
| carol.lee | tenant_ops | — | OIDC 模拟用户（无密码） |

---

## 认证

```bash
POST /api/auth/login
# 请求体: { "username": "...", "password": "..." }
# 返回: { "token": "jwt-token" }
```

JWT `scope` 字段区分域（`platform` / `tenant`），`tenantId` 强制数据隔离。

---

## 部署

### Helm（生产推荐）

```bash
helm upgrade --install hmr-server deploy/helm/human-machine-runtime \
  --namespace hmr-system --create-namespace \
  -f deploy/helm/human-machine-runtime/values-prod.yaml
```

### 可观测性

- Prometheus 告警规则：[prometheus-alert-rules.yaml](docs/shared/monitoring/prometheus-alert-rules.yaml)
- Grafana 仪表盘：[grafana-dashboard-human-machine-runtime.json](docs/shared/monitoring/grafana-dashboard-human-machine-runtime.json)

---

## 竞品定位

```
                    决策编排 + Agent 指挥
                         ↑
                         │
       HMR               │     飞书/钉钉
       (跨平台·AI决策·   │     (单平台·流程)
        人机协同)         │
  ←──────────────────────┼──────────────────→
  跨平台聚合              │          单平台深耕
                         │
       Front / Missive   │     Slack / Teams
       (跨平台·客服)      │     (单平台·协作)
                         │
                         ↓
                    单任务执行 / 沟通工具
```

| vs | HMR 差异 |
|----|---------|
| 钉钉/飞书/企微 | 它们是员工办公入口，HMR 是 Agent 指挥入口。不替代，互补共生 |
| Dify/Coze | 它们造 Agent（框架层），HMR 调兵遣将（运行时层）。上下游关系 |
| n8n/Zapier | 它们自动化确定性流程，HMR 处理需要人类判断的不确定性 |
| Harness | 架构范式相同（中间层运行时），领域不同：Harness 做代码→生产，HMR 做信息→决策 |

---

## 文档索引

| 文档 | 内容 |
|------|------|
| [HMR 架构总览](docs/architecture/hmr-architecture-overview.html) | 一页纸全局架构（单 HTML，含 Mermaid 图） |
| [产品战略白皮书](docs/product-strategy-command-center.md) | 定位/架构/竞品/商业模式/路线图 |
| [租户运营平台](docs/super-admin/) | 架构/PRD/里程碑 |
| [租户管理后台](docs/admin-console/) | 架构/PRD/里程碑 |
| [控制面](docs/control-plane/) | 架构/API 契约 |
| [用户端](docs/cockpit-client/) | 架构/PRD |
| [本地环境启动指南](docs/dev-environment-startup.md) | 全链路启动/停止（3 套 compose + 应用进程 + 端口清单） |
| [监控配置](docs/shared/monitoring/) | Prometheus + Grafana |

---

## 许可证

本项目采用 [MIT License](LICENSE)（见根目录 `LICENSE` 文件，与 `package.json` 的 `license` 字段一致）。

