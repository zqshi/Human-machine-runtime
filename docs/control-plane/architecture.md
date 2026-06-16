# DCF Control Plane — 架构设计

> 版本 1.0 | 2026-04-14 | MVP 阶段

## 1. 三面架构总览

```
┌─────────────────────────────────────────────────────────┐
│                     Control Plane                       │
│  实例编排 · 共享资产流转 · RBAC · 审计 · 管理后台 UI      │
├───────────────────┬─────────────────────────────────────┤
│   Runtime Plane   │           Asset Plane               │
│  租户 OpenClaw    │  技能 / 工具 / 知识                  │
│  隔离实例群       │  上报→审核→发布→绑定 流转            │
└───────────────────┴─────────────────────────────────────┘
```

- **Control Plane**：核心治理层，负责实例生命周期、权限、审计、共享资产管理。
- **Runtime Plane**：每个租户独立的 OpenClaw 实例，通过 K8s Pod 隔离运行。
- **Asset Plane**：跨租户共享资产（技能/工具/知识）的完整流转链路。

## 2. 后端 DDD 分层

```
src/
  contexts/                      # 限界上下文（Bounded Contexts）
    tenant-instance/             # 租户实例上下文
      domain/Instance.js         #   实例实体 + 状态机
      application/               #   InstanceService, InstanceReconciler, RuntimeProxyService
    shared-assets/               # 共享资产上下文
      domain/                    #   SharedSkill, SkillReport
      application/               #   SkillService, AssetCompatibilityService, TenantAssetResolver
    document/                    # 文档/知识上下文
      domain/                    #   DocumentLifecycle, PermissionPolicy, CategoryConstants
      application/               #   DocumentService, CategoryService, KnowledgeAuditService, StorageService
    audit-observability/         # 审计可观测上下文
      application/               #   AuditService, PlatformMetricsService
    identity-access/             # 身份权限上下文
      application/               #   AuthService
    release-management/          # 发布管理上下文
      application/               #   ReleasePreflightService, releasePreflightPolicy
  infrastructure/
    persistence/                 #   ControlPlaneRepository, SqliteStore, PostgresStore, FileStore
    k8s/                         #   Kubernetes 客户端适配
  integrations/
    matrix/                      #   Matrix bot + 命令路由
    weknora/                     #   WeKnora 知识引擎集成
  interfaces/http/
    routes/                      #   32 个 API 路由文件
    admin-ui/                    #   16 个 HTML 页面 + 对应 JS/CSS
    middleware/                  #   鉴权、权限中间件
  shared/                        #   errors, id, time, requestContext, helmValues
  app/                           #   createServer.js（Express 组装 + 启动）
  config/                        #   环境配置
```

### 2.1 六大限界上下文

| 上下文 | 职责 | domain 层 | application 层 |
|--------|------|-----------|---------------|
| **tenant-instance** | 实例生命周期：create/start/stop/rebuild/delete | Instance.js | InstanceService, InstanceReconciler, RuntimeProxyService |
| **shared-assets** | 技能/工具/知识的上报、审核、发布、绑定 | SharedSkill, SkillReport | SkillService, AssetCompatibilityService, TenantAssetResolver |
| **document** | 文档 CRUD、分类、版本、权限、审计 | DocumentLifecycle, PermissionPolicy, CategoryConstants | DocumentService, CategoryService, KnowledgeAuditService, StorageService |
| **audit-observability** | 审计日志、平台指标、SLO | — | AuditService, PlatformMetricsService |
| **identity-access** | 账户、角色、权限、JWT 会话 | — | AuthService |
| **release-management** | 发布预检、Helm 配置验证 | — | ReleasePreflightService, releasePreflightPolicy |

### 2.2 基础设施层

| 组件 | 实现 | 说明 |
|------|------|------|
| 持久化 | ControlPlaneRepository → SqliteStore / PostgresStore / FileStore | createStore 按配置选择后端 |
| K8s | @kubernetes/client-node | 实例 Pod 编排 |
| Matrix | matrix-js-sdk | Bot 消息收发、命令路由 |
| 监控 | prom-client + Prometheus + Grafana | 指标暴露 /metrics |

### 2.3 路由层

接口层遵循薄路由原则：参数提取 → 校验 → 调用 Service → 返回结果。

32 个路由文件按资源域拆分，核心分组：
- `adminCompat*.js`（14 个）：管理后台 BFF 路由（1 个索引 + 13 个子模块）
- `adminDecisionRoutes.js` / `adminModelDiscovery.js` / `adminAnalytics.js`：管理后台扩展 API
- `instances.js` / `runtime.js`：实例控制 API
- `skills.js` / `assets.js`：共享资产 API
- `auth.js`：认证授权 API
- `documents.js` / `categories.js`：文档 API
- `audits.js` / `knowledgeAudits.js`：审计 API
- `uploads.js` / `storage.js`：文件上传与存储 API
- `release.js`：发布预检 API
- `weknora.js`：WeKnora 知识引擎 API
- `matrix.js`：Matrix webhook 入口
- `health.js`：健康探针

## 3. 管理后台 UI

管理后台是独立的 Vanilla HTML/CSS/JS MPA 前端应用，有完整的架构文档：

- **架构设计** → [`docs/admin-console/architecture.md`](../admin-console/architecture.md)
- **产品需求** → [`docs/admin-console/prd.md`](../admin-console/prd.md)
- **里程碑** → [`docs/admin-console/milestones.md`](../admin-console/milestones.md)

关键特征：16 个 HTML 页面、IIFE + 依赖注入代码模式、auth-core.js 统一权限门控、layout.css 模块化样式体系。

## 4. 安全架构

- **认证**：JWT（jsonwebtoken），登录→签发→每请求校验
- **授权**：RBAC，角色→权限→资源粒度控制
- **速率限制**：express-rate-limit，本地回环地址豁免
- **安全头**：helmet（CSP、HSTS 等）
- **审计**：所有关键操作落 AuditService，支持按 context/entity/action/operator 检索与导出

## 5. 部署架构

- **本地开发**：`npm run dev`（nodemon 热重载）
- **容器化**：`docker build` + `docker run`
- **K8s**：`kubectl apply -k deploy/k8s/base`
- **可观测性**：Prometheus + Grafana + Alertmanager（`npm run observability:up`）
- **Matrix 集成**：Element Web 客户端 + Matrix Synapse homeserver
