> ⚠️ **历史文档快照**（非当前实现）：本文档为早期架构/规划/PRD 记录，部分内容已被后续演进取代。当前实现以 `server/src` + `client-suite/apps/web/src` 代码为准（28 个限界上下文 · Hono/TS/Drizzle · PostgreSQL@5435）。

# HMR 生产化架构设计

> 版本：v1.0 | 2026-05-16 | 状态：Approved

## 概述

HMR（Human-Machine Runtime）是企业级 AI 数字员工平台的统一基础设施，构建租户管理层（运管平台）、管理控制面、新一代人机交互平台三大能力。

本文档定义 HMR 的生产化架构设计，指导从演示原型到生产系统的全量改造。

> 说明：下文出现的技能市场（clawhub）、配置中心（portal）、AI 工作区（xspace）、实例编排（claw-farm）等为**可替换的系统组件代号**，企业可接入自有同类系统，详见文末「企业如何接入自有系统」。

---

## 一、平台定位与职责边界

### 1.1 HMR 三层平台

| 层级 | 平台 | 核心用户 | 职责 |
|---|---|---|---|
| L1 | 运营管理平台 | 平台运营商 | 租户生命周期、资源配额、计费结算、全局监控、安全审计 |
| L2 | 管理控制面 | 租户管理员 | 数字员工管理、Skill/Agent/Tool 管理、知识库、模型配置、实例编排 |
| L3 | 用户交互平台 | 终端用户 | IM 模式（Matrix 原生）、决策中心模式（HMR 独有）、智能工坊（创造能力） |

### 1.2 与企业现有系统的关系

HMR 通过 API 网关模式对接企业已有的同类生产系统，不合并代码：

```
HMR Platform (门户 + 控制面 + 交互平台)
    │
    ├──→ 技能市场（clawhub）        Skill/Agent 市场生态
    ├──→ 配置中心（portal）         Agent Profile/Journey
    ├──→ 平台后端（platform-be）    企业 OAuth + 凭证托管
    ├──→ AI 工作区（xspace）        Workspace/App/Agent 创建
    ├──→ 实例编排（claw-farm）      消息网关 + Channel Bridge
    └──→ LiteLLM                    统一模型路由（隔离 LLM 供应商）
```

### 1.3 Matrix IM 定位

Matrix 是 HMR 自有 IM 基础设施，不强依赖任何第三方 IM 系统：

- 用户可直接使用 HMR 内置 Matrix IM
- WPS 协作、飞书、钉钉等作为可选 Channel Bridge 接入
- 每种 Channel 独立开关，按需配置

---

## 二、架构全景

```
┌─────────────────────────── HMR Platform ───────────────────────────┐
│                                                                     │
│  ┌─ L1 运营管理平台 (Super Admin) ─────────────────────────────┐  │
│  │  租户生命周期 │ 资源配额 │ 计费结算 │ 全局监控 │ 安全审计   │  │
│  └──────────────────────────────────────────────────────────────┘  │
│                                                                     │
│  ┌─ L2 管理控制面 (Tenant Admin) ──────────────────────────────┐  │
│  │  数字员工管理 │ Skill/Agent/Tool 管理 │ 知识库管理          │  │
│  │  模型配置 │ 实例编排 │ 审计日志 │ 协作配置                  │  │
│  └──────────────────────────────────────────────────────────────┘  │
│                                                                     │
│  ┌─ L3 用户交互平台 (End User) ────────────────────────────────┐  │
│  │                                                               │  │
│  │  [IM 模式]        Matrix 原生 IM (E2EE/Federation/Bridge)    │  │
│  │                   ├── WPS 协作 Bridge (可选)                  │  │
│  │                   ├── 飞书/钉钉/企微 Bridge (可选)            │  │
│  │                   └── WebChat 直连                             │  │
│  │                                                               │  │
│  │  [决策中心模式]   HMR 独有能力                                │  │
│  │    Decision │ Sensing │ Objective │ Evaluation                │  │
│  │    Collaboration │ Escalation │ Strategic Cockpit             │  │
│  │    Canvas │ Code │ Calendar │ Orchestration                   │  │
│  │                                                               │  │
│  │  [智能工坊]       对接 xspace 创造能力                        │  │
│  │    Workspace │ App Builder │ Agent Builder │ Skill Builder   │  │
│  └──────────────────────────────────────────────────────────────┘  │
│                                                                     │
│  ┌─ 基础设施层 ────────────────────────────────────────────────┐  │
│  │  Hono API Server │ PostgreSQL (Drizzle) │ Matrix Homeserver  │  │
│  │  LiteLLM Proxy │ K8s Orchestrator │ Object Storage           │  │
│  │  API Gateway (→ 技能市场 / 配置中心 / AI 工作区 / 实例编排)   │  │
│  └──────────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────────┘
```

---

## 三、技术栈

| 层面 | 选型 | 说明 |
|---|---|---|
| 前端框架 | React 19 + TypeScript | 严格模式，DDD 四层架构 |
| 前端样式 | Tailwind CSS 3.4 | 通过 @hmr/ui-tokens preset |
| 前端状态 | Zustand | 一个 store 一个文件 |
| 后端框架 | Hono + TypeScript | 对齐企业平台后端风格 |
| 数据库 | PostgreSQL + Drizzle ORM | 主数据库，类型安全 |
| IM 基础设施 | Matrix (Conduit/Synapse) | 自有 homeserver，支持 Federation |
| AI 模型路由 | LiteLLM | 统一多模型代理（隔离供应商） |
| 容器编排 | Kubernetes | Cockpit 实例生命周期 |
| 对象存储 | S3 兼容对象存储（如 MinIO/云厂商对象存储） | 文件/资产存储 |
| 包管理 | npm workspaces (前端) + 独立 server | — |

---

## 四、后端 Bounded Context

```
server/src/
├── app/                          # 启动入口 + DI
├── config/                       # 类型化配置
├── db/                           # Drizzle schema + client + migrations
├── middleware/                   # Hono 中间件
├── routes/                       # 路由注册（按 context 分组）
├── contexts/
│   ├── identity-access/          # 认证鉴权 (AuthService)
│   ├── tenant-management/        # 租户管理 (TenantService)
│   ├── audit-observability/      # 审计监控 (AuditService + Metrics)
│   ├── shared-assets/            # 技能/资产管理 (SkillService)
│   ├── tenant-instance/          # 实例管理 (InstanceService + RuntimeProxy)
│   ├── document/                 # 文档/知识库 (DocumentService + Storage)
│   ├── release-management/       # 发布管理
│   ├── agent-core/               # HMR 核心 Agent 领域
│   │   └── domain/
│   │       ├── AgentExecutor.ts
│   │       ├── IntentRouter.ts
│   │       ├── EscalationEngine.ts
│   │       ├── CorrectionExecutor.ts
│   │       ├── AgentSimulator.ts
│   │       ├── StrategicDecoder.ts
│   │       └── TaskContract.ts
│   ├── gateway/                  # API 网关（对接外部服务）
│   │   ├── clients/              # 各组件 HTTP 客户端（技能市场/配置中心/AI工作区/实例编排/LiteLLM）
│   │   └── routes/
│   ├── workspace/                # Workspace 模型（对接 AI 工作区 xspace）
│   ├── marketplace/              # 市场对接（对接技能市场 clawhub）
│   └── agent-profile/            # Agent Profile（对接配置中心 portal）
└── integrations/
    ├── matrix/                   # Matrix Bot + Relay + Bridge
    └── weknora/                  # WeKnora 集成
```

---

## 五、数据模型概述

### 5.1 核心实体

| 实体 | 归属 Context | 说明 |
|---|---|---|
| User | identity-access | 平台用户 + 角色 + 权限 |
| Tenant | tenant-management | 租户 + 配额 + 特性开关 |
| Instance | tenant-instance | Cockpit 实例 + K8s 资源 |
| Audit | audit-observability | 全链路审计事件 |
| Skill/Asset | shared-assets | 技能包 + 审核状态 |
| Document | document | 知识库文档 + 分类 |

### 5.2 对接实体（通过 Gateway API 获取）

| 实体 | 来源 | 说明 |
|---|---|---|
| MarketSkill | 技能市场（clawhub） | 市场技能（版本/评分/下载量） |
| MarketAgent | 技能市场（clawhub） | 市场 Agent（安装命令/能力描述） |
| AgentProfile | 配置中心（portal） | Agent 画像（knowMe/knowYou/styleTags） |
| AgentJourney | 配置中心（portal） | Agent 成长日记 + 快照 |
| Workspace | AI 工作区（xspace） | 工作空间（APP/SKILL/AGENT） |
| App/Deployment | AI 工作区（xspace） | 应用 + 部署状态 |

---

## 六、Matrix IM 架构

### 6.1 层次结构

```
┌── HMR Matrix Layer ──────────────────────────────────────┐
│                                                           │
│  IMatrixClient (port interface)                          │
│    ├── RealMatrixClient  → Conduit/Synapse homeserver    │
│    ├── MockMatrixClient  → Demo/开发模式                  │
│    └── (future: 自建轻量 homeserver)                      │
│                                                           │
│  ChannelAdapter (pluggable bridge)                        │
│    ├── MatrixNativeChannel → Matrix 原生收发              │
│    ├── WpsImAdapter        → 协作工具 (via 实例编排 claw-farm) │
│    ├── FeishuAdapter       → 飞书 (Cockpit Channel)     │
│    ├── DingtalkAdapter     → 钉钉                         │
│    └── WebChatAdapter      → 浏览器内嵌 WebChat           │
│                                                           │
│  Bridge 服务端（后端）                                    │
│    接收外部 IM webhook → 转换为 Matrix 消息 → 路由到 Room │
│    接收 Matrix 回复 → 转换为外部 IM 格式 → 发送回去       │
└───────────────────────────────────────────────────────────┘
```

### 6.2 部署模式

- **开发模式**：MockMatrixClient，无需 homeserver
- **本地模式**：Conduit Docker 容器，轻量快速
- **生产模式**：Synapse 集群 + PostgreSQL，支持 E2EE + Federation

### 6.3 Channel Bridge 工作流

```
协作工具消息 → 实例编排（claw-farm） webhook → HMR Bridge 服务
    → 转换为 Matrix event → 写入 Matrix Room
    → Bot 处理 → 生成回复
    → Bridge 读取 Matrix 回复 → 转换为协作工具格式
    → 调用协作工具 API 发送
```

---

## 七、API 路由设计

### 7.1 路由前缀规范

| 前缀 | 用途 | 认证方式 |
|---|---|---|
| `/api/platform/*` | 运管平台 API | Super Admin Token |
| `/api/control/*` | 管理控制面 API | Tenant Admin Token |
| `/api/user/*` | 用户交互 API | User Token (Matrix SSO) |
| `/api/gateway/*` | 外部服务代理 | 内部 + Token 透传 |
| `/health` | 健康检查 | 无 |

### 7.2 关键端点

```
# 运管平台
POST   /api/platform/auth/login
GET    /api/platform/tenants
POST   /api/platform/tenants
GET    /api/platform/monitoring/overview
GET    /api/platform/users

# 管理控制面
GET    /api/control/instances
POST   /api/control/instances
GET    /api/control/skills
GET    /api/control/audits
GET    /api/control/knowledge-audits
PUT    /api/control/runtime/config

# 用户交互
GET    /api/user/matrix/rooms
POST   /api/user/matrix/send
GET    /api/user/decisions
GET    /api/user/sensing/signals
GET    /api/user/objectives

# 外部服务代理
GET    /api/gateway/marketplace/skills
GET    /api/gateway/profile/:agentId
POST   /api/gateway/workspace/create
GET    /api/gateway/workspace/:id/conversations
```

---

## 八、部署架构

### 8.1 Docker Compose（本地开发）

```yaml
services:
  hmr-server:     # Hono API Server
  hmr-frontend:   # React SPA (Vite dev server)
  postgres:       # PostgreSQL 15
  conduit:        # Matrix homeserver (Conduit)
  litellm:        # AI 模型代理
  minio:          # 对象存储（本地替代云对象存储，S3 兼容）
```

### 8.2 Kubernetes（生产）

```
Namespace: hmr-platform
├── Deployment: hmr-server (replicas: 2+)
├── Deployment: hmr-frontend (Nginx static)
├── StatefulSet: postgres (PVC)
├── Deployment: conduit (Matrix homeserver)
├── Deployment: litellm
├── Service: hmr-server-svc (ClusterIP)
├── Ingress: hmr.example.com
└── ConfigMap/Secret: env vars + Matrix registration
```

---

## 九、安全设计

| 层面 | 措施 |
|---|---|
| 认证 | JWT + Matrix SSO + 可选企业 OAuth |
| 授权 | RBAC (Super Admin / Tenant Admin / User) + 资源级权限 |
| 传输 | HTTPS + Matrix E2EE (端到端加密) |
| 审计 | 全链路事件记录，审计日志不可删除 |
| 隔离 | 租户数据隔离（row-level），K8s Namespace 隔离 |
| 限流 | API rate limiting（按用户/IP/租户） |

---

## 十、演进路线

```
Phase 0 → 工程基础（Hono + Drizzle + Docker Compose）
Phase 1 → Context 迁移（6 个 bounded context JS→TS）
Phase 2 → Agent Core 迁移（HMR 独有领域逻辑）
Phase 3 → API Gateway（对接三个生产项目）
Phase 4 → Matrix 全功能（homeserver + Channel Bridge）
Phase 5 → Workspace 创造能力（对接 xspace）
Phase 6 → 清理 + 文档 + 部署配置
```

全量完成后，HMR 即为企业 AI 数字员工平台的统一底座。

---

## 十一、企业如何接入自有系统

HMR 的所有外部对接均通过 `gateway/clients/` 下的标准 HTTP 客户端隔离，企业可按需替换为自有同类系统，无需改动 HMR 核心代码。各组件均通过环境变量配置接入地址：

| 组件代号 | 业务职责 | 接入方式 | 企业可替换为 |
|---------|---------|---------|-------------|
| **技能市场（clawhub）** | Skill/Agent 市场生态，提供技能列表、安装、Agent 目录 | REST API（`CLAWHUB_URL`） | 企业内部技能/Agent 市场、Dify 市场、自建插件仓库 |
| **配置中心（portal）** | Agent Profile/Journey、画像与成长档案 | REST API（`PORTAL_BE_URL`） | 企业配置中心、CMDB、自建 Agent 档案系统 |
| **AI 工作区（xspace）** | Workspace/App/Agent 创建与编排 | REST API（`XSPACE_AGENT_URL`） | Coze、Dify、自建 AI 应用生成平台 |
| **实例编排（claw-farm）** | K8s 实例编排、消息网关、Channel Bridge | REST API + K8s API | 企业自有编排平台、消息网关 |
| **平台后端（platform-be）** | 企业 OAuth + 凭证托管 | REST API（`PLATFORM_BE_URL`） | 企业统一身份/凭证服务 |
| **LiteLLM** | 统一模型路由，隔离 LLM 供应商 | REST API（OpenAI 兼容） | 任意 OpenAI 兼容网关、自建模型代理 |

**LLM 供应商隔离**：所有大模型调用统一经 LiteLLM 中转，数字员工与上层业务不直接耦合具体供应商（Anthropic/OpenAI/通义/智谱等）。企业更换或新增模型供应商时，仅需在 LiteLLM 侧配置，HMR 调用链路无感切换。

**渠道（Channel）可插拔**：IM 接入遵循 `IChannelAdapter` 标准接口，Matrix 为默认实现，企业可接入钉钉/飞书/企微/邮件等渠道，每种渠道独立开关。

**认证（Auth）可插拔**：本地密码登录为默认通道；企业 SSO 通过 OIDC 标准协议接入任意 IdP（Entra ID、Okta、Keycloak、企业自建 OAuth 等），参数经环境变量配置。
