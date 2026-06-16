> ⚠️ **历史文档快照**（非当前实现）：本文档为早期架构/规划/PRD 记录，部分内容已被后续演进取代。当前实现以 `server/src` + `client-suite/apps/web/src` 代码为准（28 个限界上下文 · Hono/TS/Drizzle · PostgreSQL@5432）。

# Phase 2：运管平台后端

## 目标
hmr-ops-be 提供平台运营商的全部 API，运管前端可用。

## 2.1 hmr-ops-be 服务设计

### 目录结构
```
service/hmr-ops-be/
├── app/
│   ├── __init__.py
│   ├── main.py
│   ├── config/
│   │   └── settings.py
│   ├── api/v1/
│   │   ├── router.py
│   │   ├── tenants.py             # 租户 CRUD + 配额
│   │   ├── platform_config.py     # 平台全局配置
│   │   ├── platform_monitoring.py # 集群/服务监控
│   │   ├── platform_users.py      # 全平台用户管理
│   │   ├── platform_audit.py      # 平台级审计
│   │   └── quotas.py              # 资源配额管理
│   ├── services/
│   │   ├── tenant_service.py
│   │   ├── quota_service.py
│   │   ├── monitoring_service.py  # K8s metrics + service health
│   │   └── audit_service.py
│   ├── models/
│   │   ├── tenant.py
│   │   ├── quota.py
│   │   └── monitoring.py
│   └── deps.py
├── tests/
├── pyproject.toml
└── Dockerfile
```

### API 路由设计

| 路由 | 方法 | 功能 |
|------|------|------|
| `/tenants` | GET | 租户列表 + 分页 + 搜索 |
| `/tenants` | POST | 创建租户 |
| `/tenants/{id}` | GET | 租户详情（含配额使用） |
| `/tenants/{id}` | PUT | 更新租户信息 |
| `/tenants/{id}` | DELETE | 禁用/删除租户 |
| `/tenants/{id}/quotas` | GET/PUT | 配额管理 |
| `/tenants/{id}/members` | GET | 租户成员列表 |
| `/config` | GET | 平台全局配置 |
| `/config` | PUT | 更新配置 |
| `/config/exchange-rates` | GET/PUT | 汇率配置 |
| `/monitoring/overview` | GET | 平台概览（租户数/用户数/实例数/API调用量） |
| `/monitoring/services` | GET | 服务健康状态 |
| `/monitoring/resources` | GET | 集群资源使用 |
| `/monitoring/alerts` | GET | 告警列表 |
| `/users` | GET | 全平台用户列表 |
| `/users/{id}` | GET | 用户详情 |
| `/users/{id}/status` | PUT | 启用/禁用用户 |
| `/audit` | GET | 平台审计日志 + 筛选 |
| `/audit/export` | GET | 审计日志导出 |
| `/quotas/templates` | GET/POST | 配额模板管理 |

### 从 super-admin-ui 迁移的功能对照

| super-admin-ui 旧文件 | 旧功能 | 新 API |
|----------------------|--------|--------|
| tenants.js | 租户列表/创建/编辑/删除 | /tenants CRUD |
| platform-config.js | 系统配置管理 | /config |
| platform-monitoring.js | 服务状态/资源监控 | /monitoring/* |
| platform-users.js | 用户管理 | /users |
| platform-audit.js | 审计日志 | /audit |
| super-auth-core.js + login.js | 超管认证 | OAuth + role=super_admin |

## 2.2 运管前端

复用 `apps/web/src/presentation/features/platform/` 已有骨架：

| 已有组件 | 升级内容 |
|---------|---------|
| PlatformPage.tsx | 保留布局，对接新 API |
| TenantsSection.tsx | 重写：CRUD + 配额管理 |
| PlatformConfigSection.tsx | 重写：配置面板 |
| PlatformMonitoringSection.tsx | 重写：实时监控 |
| PlatformUsersSection.tsx | 重写：用户管理 |

新增：
- `PlatformAuditSection.tsx`：审计日志

### API 客户端
```typescript
// apps/web/src/application/services/opsApi.ts
export class OpsApiClient {
  private baseUrl = '/api/v1/ops';
  
  tenants = {
    list: (params) => this.get('/tenants', params),
    create: (data) => this.post('/tenants', data),
    get: (id) => this.get(`/tenants/${id}`),
    update: (id, data) => this.put(`/tenants/${id}`, data),
    delete: (id) => this.delete(`/tenants/${id}`),
    getQuotas: (id) => this.get(`/tenants/${id}/quotas`),
    updateQuotas: (id, data) => this.put(`/tenants/${id}/quotas`, data),
  };
  
  config = { ... };
  monitoring = { ... };
  users = { ... };
  audit = { ... };
}
```

## 2.3 验证标准
- [ ] 租户 CRUD 全流程通过
- [ ] 配额分配和使用查询正常
- [ ] 监控面板数据渲染
- [ ] 审计日志筛选和导出
- [ ] 超管权限判断正确
