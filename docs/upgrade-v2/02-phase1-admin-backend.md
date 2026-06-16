# Phase 1：管理控制面后端

## 目标
dcf-admin-be 提供租户管理员所需的全部 API，管理前端重写为 React。

## 1.1 dcf-admin-be 服务设计

### 目录结构
```
service/dcf-admin-be/
├── app/
│   ├── __init__.py
│   ├── main.py                    # FastAPI app + lifespan + CORS
│   ├── config/
│   │   ├── __init__.py
│   │   └── settings.py            # pydantic-settings 配置
│   ├── api/
│   │   ├── __init__.py
│   │   └── v1/
│   │       ├── __init__.py
│   │       ├── router.py          # 汇总路由
│   │       ├── employees.py       # 数字员工 CRUD
│   │       ├── skills.py          # 技能管理（代理 clawhub）
│   │       ├── tools.py           # 工具/MCP Provider 管理
│   │       ├── models.py          # LLM 模型配置
│   │       ├── risk_rules.py      # 风控规则 CRUD
│   │       ├── instances.py       # OpenClaw 实例监控
│   │       ├── members.py         # 租户成员管理
│   │       ├── analytics.py       # 用量统计
│   │       ├── logs.py            # 审计日志
│   │       ├── shared_agents.py   # 共享 Agent 管理
│   │       └── notifications.py   # 通知管理
│   ├── services/
│   │   ├── __init__.py
│   │   ├── employee_service.py
│   │   ├── clawhub_client.py      # HTTP 客户端 → clawhub
│   │   ├── claw_farm_client.py    # K8s API → claw-farm 实例
│   │   ├── xspace_client.py       # HTTP 客户端 → xspace
│   │   ├── litellm_client.py      # LiteLLM 管理 API
│   │   └── notification_service.py
│   ├── models/
│   │   ├── __init__.py
│   │   ├── employee.py            # Pydantic schemas
│   │   ├── skill.py
│   │   ├── tool.py
│   │   ├── llm_model.py
│   │   └── common.py
│   └── deps.py                    # 依赖注入
├── tests/
│   ├── conftest.py
│   ├── test_employees.py
│   ├── test_skills.py
│   └── test_models.py
├── pyproject.toml
├── .env.example
└── Dockerfile
```

### API 路由设计

| 路由 | 方法 | 功能 | 数据源 |
|------|------|------|--------|
| `/employees` | GET | 列表 + 分页 + 筛选 | MySQL DigitalEmployee |
| `/employees` | POST | 创建数字员工 | MySQL + claw-farm |
| `/employees/{id}` | GET | 详情 | MySQL + portal-backend profile |
| `/employees/{id}` | PUT | 更新配置 | MySQL |
| `/employees/{id}` | DELETE | 删除/停用 | MySQL + claw-farm |
| `/employees/{id}/status` | GET | 实时状态 | claw-farm API |
| `/skills` | GET | 列表（代理 clawhub） | clawhub API |
| `/skills/{slug}` | GET | 详情 | clawhub API |
| `/skills/install` | POST | 为员工安装技能 | clawhub + MySQL |
| `/skills/policy` | GET/PUT | 技能策略 | MySQL |
| `/tools` | GET/POST/PUT/DELETE | 工具 CRUD | MySQL |
| `/tools/approvals` | GET/POST | 工具审批 | MySQL |
| `/models` | GET/POST/PUT/DELETE | LLM 模型 CRUD | MySQL LlmModel |
| `/models/discover` | POST | 模型发现 | LiteLLM API |
| `/risk-rules` | GET/POST/PUT/DELETE | 风控规则 CRUD | MySQL RiskRule |
| `/instances` | GET | 实例列表 | K8s API |
| `/instances/{id}/logs` | GET | 实例日志 | K8s API |
| `/instances/statistics` | GET | 统计 | K8s API + MySQL |
| `/members` | GET/POST/PUT/DELETE | 成员管理 | MySQL TenantMembership |
| `/analytics/tokens` | GET | Token 消耗统计 | MySQL AiTrace |
| `/analytics/costs` | GET | 成本统计 | MySQL CostRecord |
| `/analytics/dashboard` | GET | 仪表盘数据 | 聚合多表 |
| `/logs` | GET | 审计日志 + 筛选 | PG platformAuditLogs |
| `/shared-agents` | GET/POST/DELETE | 共享 Agent | clawhub agents API |
| `/notifications` | GET/PUT | 通知列表 + 已读 | MySQL |

### 依赖
```toml
[project]
dependencies = [
    "fastapi>=0.115",
    "uvicorn[standard]>=0.30",
    "httpx>=0.27",
    "prisma>=0.15",
    "pydantic-settings>=2.4",
    "python-jose[cryptography]>=3.3",
    "kubernetes>=30.1",
]
```

## 1.2 管理前端重写

### 迁移映射

| admin-ui 旧文件 | 新组件 | 功能保留 |
|-----------------|--------|---------|
| employees.js + employee-form-renderer.js + employee-detail-renderer.js | `EmployeesSection.tsx` | 列表/表单/详情抽屉 |
| skills.js + skill-detail-renderer.js + skills-policy.js | `SkillsSection.tsx` | 技能列表/详情/策略配置 |
| tools.js + tools-approvals.js | `ToolsSection.tsx` | 工具列表/审批流 |
| ai-gateway.js + ai-gw.js + ai-gateway-templates.js | `AIGatewaySection.tsx` | 4-Tab（模型/风控/追踪/成本） |
| openclaw-monitor.js + openclaw-statistics.js | `InstancesSection.tsx` | 实例状态/统计面板 |
| logs.js + logs-filters.js + logs-stats.js | `LogsSection.tsx` | 日志列表/筛选/统计 |
| auth*.js (6个文件) | `AuthSection.tsx` | 成员/角色/权限/审计 |
| shared-agents.js | `SharedAgentsSection.tsx` | 共享Agent管理 |
| notifications.js | `NotificationsSection.tsx` | 通知管理 |

### API 客户端
```typescript
// apps/web/src/application/services/adminApi.ts
export class AdminApiClient {
  private baseUrl = '/api/v1/admin';
  
  // 每个 Section 对应一组方法
  employees = {
    list: (params) => this.get('/employees', params),
    create: (data) => this.post('/employees', data),
    get: (id) => this.get(`/employees/${id}`),
    update: (id, data) => this.put(`/employees/${id}`, data),
    delete: (id) => this.delete(`/employees/${id}`),
    getStatus: (id) => this.get(`/employees/${id}/status`),
  };
  
  skills = { ... };
  tools = { ... };
  models = { ... };
  // ...
}
```

## 1.3 验证标准
- [ ] dcf-admin-be 全部 API 可通过 httpie/curl 调用
- [ ] 管理前端 AdminPage 所有 Section 渲染正常
- [ ] 创建/编辑/删除数字员工全流程通过
- [ ] 从 clawhub 获取技能列表成功（联调）
- [ ] AI Gateway 模型配置 CRUD 通过
