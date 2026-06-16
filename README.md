# DCF — 企业决策指挥运行时

> Enterprise Runtime for Human-Agent Collaborative Decision Making

DCF（Digital Crew Factory）是面向**央国企及中大型企业知识工作者**的决策指挥运行时。它不是 IM，不是 Agent 框架，不是项目管理工具——而是坐在这些之上的**中间层操作系统**：聚合多渠道消息、AI 智能分拣、人机协同决策、命令下达到执行闭环追踪。

---

## 为什么是 DCF

### 核心差异化

| 卖点 | 说明 |
|------|------|
| **跨平台政治护城河** | 钉钉不会帮你聚合飞书消息，飞书不会帮你聚合企微——只有中立第三方能做跨 IM 聚合。这不是技术壁垒，是政治壁垒 |
| **三层解耦架构** | Agent 框架可换（OpenClaw/Dify/Coze）、渠道可换（钉钉/飞书/企微/Matrix）——运行时层消息归一化+决策引擎+执行编排不可替代 |
| **运行时即价值** | 不造 Agent，只调度 Agent；不替代 IM，只聚合 IM。做的是"信息到决策"的运行时，类比 Harness 做"代码到生产"的运行时 |
| **效果付费** | 不要求企业采购。IM 内免费装"决策助理"，按决策闭环次数收费。零迁移成本，零采购门槛 |

### 不是什么

| 容易混淆的 | DCF 的区别 |
|-----------|-----------|
| 又一个 IM | 不承载日常聊天，只处理需要注意力的高价值信号 |
| 又一个 Agent 平台 | 不构建 Agent，只调度和指挥 Agent（类比：工厂造兵，DCF 是司令部调兵） |
| 又一个项目管理工具 | 不管任务拆解，只管决策→执行→回执的闭环 |
| 某个 IM 的插件 | 跨所有 IM 的上层运行时，不依附任何单一平台 |

### 三层解耦架构

```mermaid
graph TB
  subgraph Upper["上层 · Agent 框架（可插拔）"]
    OC["OpenClaw"] ~~~ Dify ~~~ Coze ~~~ Custom["自研框架"]
  end

  ARA{{"AgentRuntimeAdapter 标准接口"}}

  subgraph Core["中层 · DCF Enterprise Runtime（核心）"]
    MsgNorm["消息归一化"]
    Priority["优先级评估"]
    Dedup["跨渠道去重"]
    Decision["决策引擎"]
    Orchestrate["编排引擎"]
    Receipt["回执路由"]
  end

  CA{{"ChannelAdapter 标准接口"}}

  subgraph Lower["下层 · 渠道适配器（可插拔）"]
    Matrix ~~~ WPS["WPS"] ~~~ DingTalk["钉钉"] ~~~ Feishu["飞书"] ~~~ WeCom["企微"]
  end

  Upper --> ARA --> Core --> CA --> Lower

  style Core fill:#e8f0fe,stroke:#007AFF,stroke-width:2px
  style ARA fill:#fff3cd,stroke:#ffc107
  style CA fill:#fff3cd,stroke:#ffc107
```

> 产品战略详见 [产品战略白皮书](docs/product-strategy-command-center.md)

---

## 快速开始

### 前置条件

- Node.js >= 20
- npm >= 10
- Docker & Docker Compose（用于 PostgreSQL）

### 启动步骤

```bash
# 1. 启动基础设施（PostgreSQL 16，端口 5434）
docker compose up -d postgres

# 2. 安装依赖
npm install
cd server && npm install && cd ..
cd client-suite/apps/web && npm install && cd ../../..

# 3. 配置环境变量
cd server && cp .env.example .env   # 按需编辑
cd ..

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

### 运行时四面体

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
    OC2["OpenClaw (默认)"]
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

### DDD 限界上下文（24 个）

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

DCF 用户端内置五大子系统，构成完整的 Agent 指挥操作系统：

| 子系统 | 功能 | 前端入口 | 后端路由 |
|--------|------|----------|----------|
| **战略驾驶舱** | 目标树、信心度仪表盘、战略提问器、部门矩阵 | `strategic-cockpit` | `/api/openclaw/objectives` |
| **编排中心** | 协作链管理、Agent 调度、升维时间线 | `orchestration` | `/api/openclaw/orchestration/*` |
| **感知反馈** | 信号雷达、模式识别、紧急信号检测 | `sensing` | `/api/openclaw/signals/*` |
| **考核评估** | 人机双轨仪表盘、趋势分析、记分卡 | `evaluation` | `/api/openclaw/evaluation/*` |
| **判断推理** | 判断工作台、信号时间线、修正图谱 | `judgment` | `/api/openclaw/decisions/*` |

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
| 轻应用 | apps | 应用网格 |
| 通讯录 | contacts | 联系人管理 |
| 知识库 | knowledge | 文档/知识库管理 |
| 待办 | tasks | 任务管理 |
| 通知 | notifications | 通知中心 |
| 日历 | calendar | 日程管理 |
| 动态 | subscription | 信息流订阅 |
| 工作面板 | openclaw | 决策中心（任务/信号/协作/渠道） |
| Agent | agents | Agent Hub + 详情/配置 |
| 战略 | strategic-cockpit | Enterprise Agent OS · 战略驾驶舱 |
| 编排 | orchestration | Enterprise Agent OS · 编排中心 |
| 感知 | sensing | Enterprise Agent OS · 感知反馈 |
| 考核 | evaluation | Enterprise Agent OS · 考核评估 |
| 判断 | judgment | Enterprise Agent OS · 判断推理 |

### 管理后台（admin.html）

| 模块 | 说明 |
|------|------|
| 运营数据 | OpenClaw 统计概览 + 运行监控 |
| 员工管理 | 数字员工 CRUD + 详情/编辑/资源/话题 |
| 共享 Agent | 跨租户共享 Agent 注册/绑定 |
| 技能管理 | 技能详情 + 策略配置 |
| 工具管理 | 工具资产管理 |
| AI Gateway | 模型路由/调用追踪/成本分析/风控规则 |
| 配额管理 | 配额仪表盘/分配/告警 |
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

DCF 的所有外部对接均通过 `server/src/contexts/gateway/clients/` 下的标准 HTTP 客户端隔离，企业可按需将下列组件替换为自有同类系统，无需改动 DCF 核心代码。各组件均通过环境变量配置接入地址。

| 组件代号 | 业务职责 | 接入方式（环境变量） | 企业可替换为 |
|---------|---------|---------------------|-------------|
| **技能市场（clawhub）** | Skill/Agent 市场生态：技能列表、安装、Agent 目录 | REST API `CLAWHUB_URL` | 企业内部技能/Agent 市场、Dify 市场、自建插件仓库 |
| **配置中心（portal）** | Agent Profile/Journey、画像与成长档案 | REST API `PORTAL_BE_URL` | 企业配置中心、CMDB、自建 Agent 档案系统 |
| **AI 工作区（xspace）** | Workspace/App/Agent 创建与编排 | REST API `XSPACE_AGENT_URL` | Coze、Dify、自建 AI 应用生成平台 |
| **实例编排（claw-farm）** | K8s 实例编排、消息网关、Channel Bridge | REST API + K8s API | 企业自有编排平台、消息网关 |
| **平台后端（platform-be）** | 企业 OAuth + 凭证托管 | REST API `PLATFORM_BE_URL` | 企业统一身份/凭证服务 |
| **实例管理（claw-manager）** | 数字员工实例数据源 | REST API | 企业实例管理服务 |

**LLM 供应商隔离**：所有大模型调用统一经 **LiteLLM** 中转，数字员工与上层业务不直接耦合具体供应商（Anthropic/OpenAI/通义/智谱等）。企业更换或新增模型供应商时，仅需在 LiteLLM 侧配置，DCF 调用链路无感切换。

**渠道（Channel）可插拔**：IM 接入遵循 `IChannelAdapter` 标准接口，Matrix 为默认实现，企业可接入钉钉/飞书/企微/邮件等渠道，每种渠道独立开关。

**认证（Auth）可插拔**：本地密码登录为默认通道；企业 SSO 通过 OIDC 标准协议接入任意 IdP（Entra ID、Okta、Keycloak、企业自建 OAuth 等），参数经环境变量配置。

> 架构层面的对接关系与可替换性详见 [生产化架构设计 · 十一、企业如何接入自有系统](docs/architecture/production-architecture.md)。

---

## 渠道集成

DCF 通过标准化 `IChannelAdapter` 接口接入通信渠道，`ChannelService` 统一注册和调度。

### 已实现

| 渠道 | 适配器 | 能力 |
|------|--------|------|
| **Matrix** | `MatrixChannelAdapter` | 发送/接收/房间列表/健康检测 |
| **WPS** | `WpsChannelAdapter` | 双向消息/入站消息流/渠道列表 |
| **WebSocket** | `WebSocketChannelAdapter` | 实时推送/客户端连接管理 |

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

通过 `IAgentRuntimeAdapter` 标准接口对接任意 Agent 框架，`AgentRuntimeAdapterRegistry` 统一注册和调度。

### 接口定义

```typescript
interface IAgentRuntimeAdapter {
  readonly framework: AgentFramework; // 'openclaw' | 'dify' | 'coze' | 'langchain' | 'custom'
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
| **OpenClaw** | `OpenClawAdapter` | 默认 Agent 框架，对接实例管理服务管理实例 |

---

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

### 决策中心（/api/openclaw）

| 路径 | 说明 |
|------|------|
| `/api/openclaw/tasks/*` | 任务管理 |
| `/api/openclaw/decisions/*` | 决策管理 |
| `/api/openclaw/signals/*` | 信号/模式/修正 |
| `/api/openclaw/objectives/*` | 目标/战略分解 |
| `/api/openclaw/collaboration` | 协作 |
| `/api/openclaw/orchestration/*` | 编排链/升维/Agent 注册 |
| `/api/openclaw/evaluation/*` | 指标/记分卡/双轨/趋势 |
| `/api/openclaw/channels` | 渠道管理 |
| `/api/openclaw/workspace` | 工作空间 |

### Gateway 代理（/api/proxy）

| 路径 | 上游服务 |
|------|----------|
| `/api/proxy/marketplace` | 技能市场（clawhub） |
| `/api/proxy/profile` | 配置中心（portal） |
| `/api/proxy/workspace` | AI 工作区（xspace） |
| `/api/proxy/channel` | 实例编排（claw-farm） |
| `/api/proxy/mcp` | MCP 服务 |

---

## 项目结构

```
dcf-light-bot/
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
        openclaw/                        # 用户端决策中心 + Enterprise Agent OS
      contexts/                          # DDD 限界上下文 ×24
        runtime-engine/                  # 核心运行时引擎（消息归一化/优先级/去重/推荐/回执）
        agent-core/                      # Agent 执行 + AgentRuntimeAdapter 接口
        channel/                         # ChannelAdapter 接口 + 适配器 + 路由 + 决策控台
        gateway/clients/                 # 8 个上游服务客户端
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
        domain/                          # 纯业务逻辑（12 子域）
        infrastructure/                  # API client + Matrix + channels
        application/                     # zustand stores + hooks + services
        presentation/                    # React 组件（25 feature 模块）
    packages/ui-tokens/                  # 设计 token
  charts/dcf-server/                     # 生产 Helm Chart
  deploy/                                # K8s manifests + Docker Compose + 可观测性
```

---

## 开发命令

### 根目录

```bash
npm run dev              # 启动后端（tsx watch 热重载，端口 3002）
npm run build            # 构建后端
npm start                # 启动构建产物
npm test                 # 后端测试（vitest，232 文件）
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
npx vitest run           # 测试（270 文件）
```

### Docker Compose

```bash
docker compose up -d postgres            # PostgreSQL 16（端口 5434）
docker compose up -d redis               # Redis 7（端口 6379）
docker compose --profile weknora up -d   # WeKnora RAG 服务（端口 8088）
docker compose --profile full up -d      # 全部服务（含 Matrix Conduit）
```

---

## 技术栈

### 前端

| 项 | 选型 | 约束 |
|----|------|------|
| 框架 | React + TypeScript | 严格模式，no any |
| 样式 | Tailwind CSS 3.4 | 通过 `@dcf/ui-tokens` preset |
| 状态 | zustand | 一个 store 一个文件 |
| 设计语言 | Apple HIG glass morphism | 主色 `#007AFF` |
| 测试 | vitest | 270 文件 |

### 后端

| 项 | 选型 | 约束 |
|----|------|------|
| 运行时 | Node.js 20+ | ESM，TypeScript strict |
| 框架 | Hono | 路由薄层，中间件链式组合 |
| ORM | Drizzle | TypeScript-first，PostgreSQL |
| 数据库 | PostgreSQL 16 | 本地 5434 端口 |
| 认证 | JWT + SSO 预留 | bcrypt 密码 |
| 测试 | vitest | 232 文件 |

---

## 数据库

| 项 | 值 |
|----|-----|
| 数据库 | PostgreSQL 16 |
| ORM | Drizzle |
| 本地端口 | 5434 |
| 连接串 | `postgresql://dcf:dcf@localhost:5434/dcf` |

```bash
npm run db:setup                 # 迁移 + 种子数据（7 个默认账号）
cd server && npm run db:studio   # Drizzle Studio 数据浏览
```

### 种子账号（Production profile）

| 用户名 | 角色 | 密码 |
|--------|------|------|
| admin | platform_admin | admin123 |
| tenant_admin | tenant_admin | tenant123 |
| ops | tenant_ops | ops123 |
| auditor | tenant_auditor | audit123 |

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
helm upgrade --install dcf-server charts/dcf-server \
  --namespace dcf-system --create-namespace \
  -f charts/dcf-server/values-prod.yaml
```

### 可观测性

- Prometheus 告警规则：[prometheus-alert-rules.yaml](docs/shared/monitoring/prometheus-alert-rules.yaml)
- Grafana 仪表盘：[grafana-dashboard-dcf-light-bot.json](docs/shared/monitoring/grafana-dashboard-dcf-light-bot.json)

---

## 竞品定位

```
                    决策编排 + Agent 指挥
                         ↑
                         │
       DCF               │     飞书/钉钉
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

| vs | DCF 差异 |
|----|---------|
| 钉钉/飞书/企微 | 它们是员工办公入口，DCF 是 Agent 指挥入口。不替代，互补共生 |
| Dify/Coze | 它们造 Agent（框架层），DCF 调兵遣将（运行时层）。上下游关系 |
| n8n/Zapier | 它们自动化确定性流程，DCF 处理需要人类判断的不确定性 |
| Harness | 架构范式相同（中间层运行时），领域不同：Harness 做代码→生产，DCF 做信息→决策 |

---

## 文档索引

| 文档 | 内容 |
|------|------|
| [产品战略白皮书](docs/product-strategy-command-center.md) | 定位/架构/竞品/商业模式/路线图 |
| [租户运营平台](docs/super-admin/) | 架构/PRD/里程碑 |
| [租户管理后台](docs/admin-console/) | 架构/PRD/里程碑 |
| [控制面](docs/control-plane/) | 架构/API 契约 |
| [用户端](docs/openclaw-client/) | 架构/PRD |
| [监控配置](docs/shared/monitoring/) | Prometheus + Grafana |
