# 租户运营平台 — 架构设计

> 版本 1.1 | 2026-04-15

## 1. 定位

租户运营平台（Tenant Operations Platform）是 DCF 平台运营方的专属控制台，负责：

- **租户生命周期管理**：开通 / 暂停 / 归档 / 配额调整
- **平台用户管理**：platform_admin / platform_ops 角色的 CRUD
- **跨租户运营监控**：健康指标 / SLA / 成本聚合 / 告警
- **全局配置管理**：OpenClaw 运行时配置 / 模型 Provider / 风控规则
- **跨租户审计**：审计日志查询 / 导出

**与租户管理后台（Tenant Admin Console）完全独立**，两者定位不同、功能不重叠。

## 2. 双控制台部署拓扑

```
                    ┌─────────────────────────────────────┐
                    │           Express Server             │
                    │                                      │
  /super-admin/*  → │  租户运营平台 UI (静态文件)            │
  /admin/*        → │  Tenant Admin UI (静态文件, 现有)      │
                    │                                      │
  /api/platform/* → │  Platform API (超级管理后台专用)       │
  /api/admin/*    → │  Tenant BFF API (租户管理后台专用)     │
  /api/control/*  → │  Control Plane API (内部/SDK 调用)    │
                    └─────────────────────────────────────┘
```

同一 Express 进程，不同 URL 前缀，共享后端服务层。

### 2.1 URL 路径规划

| 前缀 | 用途 | 认证域 |
|------|------|--------|
| `/super-admin/*` | 租户运营平台静态页面 | platform scope |
| `/admin/*` | 租户管理后台静态页面 | tenant scope |
| `/api/platform/*` | 平台 API（超级管理后台调用） | platform scope JWT |
| `/api/admin/*` | 租户 BFF API（租户管理后台调用） | tenant scope JWT |
| `/api/control/*` | 控制面 SDK API | control plane token |

## 3. 技术栈

与租户管理后台一致，遵循项目现有约束：

| 项 | 选型 |
|----|------|
| 前端框架 | Vanilla HTML/CSS/JS（IIFE MPA 模式） |
| 样式 | 共享 `layout-base.css` / `layout-extra.css` / `layout-drawer-*.css` |
| 后端 | Express 路由薄层 |
| 认证 | JWT（scope=platform，独立登录入口） |
| 依赖注入 | `window.__superAdminXxxRenderer` IIFE 模式 |

## 4. 页面架构

### 4.1 页面清单

| 页面 | 文件 | 功能 |
|------|------|------|
| 平台登录 | `login.html` + `login.js` | 独立登录入口，只接受 platform 域角色 |
| 租户管理 | `tenants.html` + `tenants.js` | 租户 CRUD + 配额调整 + 状态流转 |
| 平台用户 | `platform-users.html` + `platform-users.js` | 平台域用户管理 |
| 运营监控 | `platform-monitoring.html` + `platform-monitoring.js` | 跨租户资源利用率 / 健康状态 |
| 全局配置 | `platform-config.html` + `platform-config.js` | 运行时配置可编辑 |
| 跨租户审计 | `platform-audit.html` + `platform-audit.js` | 审计日志查询 |

### 4.2 文件目录

```
src/interfaces/http/super-admin-ui/
  login.html              # 登录页
  login.js
  tenants.html            # 租户管理
  tenants.js
  platform-users.html     # 平台用户管理
  platform-users.js
  platform-monitoring.html  # 运营监控
  platform-monitoring.js
  platform-config.html    # 全局配置
  platform-config.js
  platform-audit.html     # 跨租户审计
  platform-audit.js
  super-auth-core.js      # 认证基础设施（类似 auth-core.js）
  super-admin-base.css    # 表单控件共享样式
```

### 4.3 super-auth-core.js

与现有 `auth-core.js` 结构相同，核心差异：

| 方面 | auth-core.js（租户） | super-auth-core.js（平台） |
|------|---------------------|--------------------------|
| 会话检查 | `GET /api/auth/me` | `GET /api/platform/auth/me` |
| 登录重定向 | `/admin/login.html` | `/super-admin/login.html` |
| 侧栏导航 | 10 个租户级菜单项 | 5 个平台级菜单项 |
| 品牌标识 | "管理后台" | "租户运营平台" |
| 角色显示 | tenant_admin/ops/auditor | platform_admin/ops |

### 4.4 共享 CSS 策略

提取公共样式到 `src/interfaces/http/shared-assets/`：

```
shared-assets/
  layout-base.css       # 从 admin-ui/ 提取
  layout-extra.css
  layout-drawer-a.css
  layout-drawer-b.css
  layout.css
```

两个控制台通过 `/shared-assets/layout-base.css` 引用公共样式。

## 5. 认证与权限模型

### 5.1 角色体系

**两个独立域，互不交叉**：

```
平台域（scope: platform）          租户域（scope: tenant）
├─ platform_admin                  ├─ tenant_admin
│  权限: platform:*                │  权限: tenant:instance:*, tenant:asset:*, ...
└─ platform_ops                    ├─ tenant_ops
   权限: platform:tenant:read,    │  权限: tenant:instance:read/write, ...
         platform:monitoring:read  └─ tenant_auditor
                                      权限: tenant:*:read, tenant:audit:read
```

### 5.2 JWT 结构

```json
// 平台用户
{
  "sub": "admin",
  "scope": "platform",
  "role": "platform_admin",
  "permissions": ["platform:*"]
}

// 租户用户
{
  "sub": "zhang",
  "scope": "tenant",
  "tenantId": "tn_xxx",
  "role": "tenant_admin",
  "permissions": ["tenant:instance:*", "tenant:asset:*", ...]
}
```

### 5.3 登录入口分离

| 入口 | API | 校验 |
|------|-----|------|
| `/super-admin/login.html` | `POST /api/platform/auth/login` | 只接受 platform 域角色 |
| `/admin/login.html` | `POST /api/auth/login` | 只接受 tenant 域角色 + 必须指定 tenantSlug |

### 5.4 API 中间件

```
/api/platform/* → buildPlatformAuthMiddleware
                  ├─ 验证 JWT scope === 'platform'
                  └─ 拒绝 tenant 域 token

/api/admin/*    → buildTenantAuthMiddleware
                  ├─ 验证 JWT scope === 'tenant'
                  ├─ 自动注入 req.principal.tenantId
                  └─ 所有查询强制按 tenantId 过滤
```

## 6. 租户实体模型

### 6.1 Tenant（限界上下文：tenant-management）

```js
{
  id: 'tn_xxx',                    // 租户唯一标识
  name: '某某公司',                 // 显示名
  slug: 'acme-corp',               // URL 友好标识 + K8s namespace 后缀
  plan: 'standard',                // free / standard / enterprise
  quotas: {
    // 容量
    maxInstances: 10,
    maxConcurrentInstances: 5,
    maxUsers: 50,
    // 实例资源（K8s 格式）
    instanceCpu: '500m',
    instanceMemory: '512Mi',
    instanceStorage: '2Gi',
    // AI 用量
    tokenBudgetMonthly: 1000000,
    tokenBudgetDaily: 50000,
    apiCallsDaily: 10000,
    rateLimitPerMinute: 60,
    // 数据策略
    maxStorageMB: 10240,
    knowledgeBaseSizeMB: 1024,
    dataRetentionDays: 90,
    maxWebhooks: 10
  },
  status: 'active',                // active / suspended / archived
  contactEmail: 'admin@acme.com',  // 租户联系邮箱
  contactName: '张某',              // 负责人姓名
  contactPhone: '138xxxx',          // 负责人电话
  industry: 'technology',           // 行业
  companySize: 'medium',            // 企业规模
  description: '',                  // 备注
  features: {                      // 功能开关
    aiGateway: true,
    knowledgeBase: true,
    matrixIntegration: false,
    customTools: true
  },
  modelAccess: {                   // 模型访问控制（用量限制已归 quotas）
    allowedProviders: ['openai', 'deepseek']
  },
  createdAt: '2026-...',
  updatedAt: '2026-...'
}
```

### 6.2 状态流转

```
active ──suspend──► suspended ──activate──► active
  │                     │
  └──archive──► archived ◄──archive──┘
                  (终态，不可恢复)
```

### 6.3 配额四维度模型

| 维度 | 字段 | free | standard | enterprise |
|------|------|------|----------|------------|
| 容量 | maxInstances | 3 | 10 | 100 |
| 容量 | maxConcurrentInstances | 2 | 5 | 50 |
| 容量 | maxUsers | 5 | 50 | 500 |
| 实例资源 | instanceCpu | 250m | 500m | 1000m |
| 实例资源 | instanceMemory | 256Mi | 512Mi | 1Gi |
| 实例资源 | instanceStorage | 1Gi | 2Gi | 5Gi |
| AI 用量 | tokenBudgetMonthly | 100K | 1M | 10M |
| AI 用量 | tokenBudgetDaily | 5K | 50K | 500K |
| AI 用量 | apiCallsDaily | 1K | 10K | 100K |
| AI 用量 | rateLimitPerMinute | 20 | 60 | 300 |
| 数据策略 | maxStorageMB | 1 GB | 10 GB | 100 GB |
| 数据策略 | knowledgeBaseSizeMB | 256 MB | 1 GB | 10 GB |
| 数据策略 | dataRetentionDays | 30 | 90 | 365 |
| 数据策略 | maxWebhooks | 2 | 10 | 50 |

切换套餐后，所有配额字段自动按套餐默认值填充，支持手动微调。
旧数据兼容：`parseQuotas()` 对缺失字段自动补充套餐默认值。

## 7. Platform API 契约

### 7.1 认证

| 方法 | 路径 | 说明 |
|------|------|------|
| POST | `/api/platform/auth/login` | 平台登录 |
| GET | `/api/platform/auth/me` | 当前平台会话 |
| POST | `/api/platform/auth/logout` | 平台登出 |

### 7.2 租户管理

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/api/platform/tenants` | 租户列表 |
| POST | `/api/platform/tenants` | 创建租户（含初始管理员） |
| GET | `/api/platform/tenants/:id` | 租户详情 |
| POST | `/api/platform/tenants/:id` | 更新租户 |
| POST | `/api/platform/tenants/:id/suspend` | 暂停（冻结全部实例） |
| POST | `/api/platform/tenants/:id/activate` | 激活 |
| POST | `/api/platform/tenants/:id/archive` | 归档（软删除） |
| GET | `/api/platform/tenants/:id/usage` | 用量统计 |

### 7.3 平台用户

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/api/platform/users` | 平台用户列表 |
| POST | `/api/platform/users` | 创建平台用户 |
| POST | `/api/platform/users/:id` | 更新平台用户 |
| POST | `/api/platform/users/:id/delete` | 删除平台用户 |

### 7.4 监控与审计

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/api/platform/monitoring/overview` | 跨租户运营总览（含资源汇总） |
| GET | `/api/platform/monitoring/resources` | 租户配额利用率（实例/并发/CPU/内存/存储百分比） |
| GET | `/api/platform/monitoring/health` | 跨租户健康指标 |
| GET | `/api/platform/audit` | 跨租户审计日志 |

### 7.5 全局配置

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/api/platform/config/openclaw` | 当前 OpenClaw 全局配置 |
| POST | `/api/platform/config/openclaw` | 更新 OpenClaw 全局配置 |
| GET | `/api/platform/config/providers` | 模型 Provider 列表 |
| POST | `/api/platform/config/providers` | 更新 Provider 配置 |

## 8. 数据隔离策略

### 8.1 存储层

```
ControlPlaneRepository
  ├─ listInstances(tenantId?)     // tenantId=null 返回全量（平台用）
  ├─ listAssets(tenantId?)        // 同上
  ├─ listSkills(tenantId?)
  ├─ listAuditLogs(tenantId?)
  └─ listTenants()                // 仅平台 API 使用
```

### 8.2 API 层隔离

- **Platform API** (`/api/platform/*`): 无 tenantId 限制，查看全量数据
- **Tenant BFF API** (`/api/admin/*`): 从 JWT 强制提取 tenantId，不可越权
- **Control Plane API** (`/api/control/*`): 内部 SDK 调用，按请求参数过滤

### 8.3 K8s 命名空间

```
旧模型: dcf-{instance.tenantId}  → 每个实例独立 namespace（tenantId 是随机的）
新模型: dcf-{tenant.slug}        → 同租户实例共享 namespace
```

## 9. 与租户管理后台的边界

| 维度 | 租户运营平台 | 租户管理后台 |
|------|------------|------------|
| URL | `/super-admin/*` | `/admin/*` |
| API | `/api/platform/*` | `/api/admin/*` |
| 角色 | platform_admin / platform_ops | tenant_admin / tenant_ops / tenant_auditor |
| 数据范围 | 全量（跨租户） | 本租户数据 |
| 登录 | 独立登录页 | 独立登录页（需选择租户） |
| CSS | 共享 shared-assets | 共享 shared-assets |
| 认证文件 | super-auth-core.js | auth-core.js |

## 10. 数据迁移策略

### 10.1 零破坏性迁移

```
1. 创建 "default" 租户（id: 'default', slug: 'default', plan: 'enterprise'）
2. 所有现有 Instance 的 tenantId → 'default'
3. 现有 platform_admin 用户 → scope: 'platform'（可登录超级管理后台）
4. 现有 ops_admin/reviewer/auditor → scope: 'tenant', tenantId: 'default'
5. K8s 现有 pod 不迁移，新建实例使用 per-tenant namespace
```

### 10.2 迁移验证

- 现有租户运营平台登录正常
- 现有租户管理后台（default 租户）功能无回归
- 所有测试通过
