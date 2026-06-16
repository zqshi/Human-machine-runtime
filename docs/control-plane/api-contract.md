# DCF Control Plane — API 契约

> 版本 1.11.0 | 2026-04-14

本文档是 `docs/shared/contracts/openapi/control-plane-v1.yaml` 的可读摘要。

## 1. 约定

| 项 | 值 |
|----|-----|
| 基础路径 | `/api/control` (正式) / `/api/admin` (BFF 兼容) |
| 认证 | `Authorization: Bearer <JWT>` |
| Content-Type | `application/json` |
| 错误格式 | `{ error: string, details?: any }` |
| 错误码 | 400 参数错误 / 401 未登录 / 403 无权限 / 404 不存在 |

## 2. 健康与监控

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/health` | 健康探针 |
| GET | `/status` | 运行时状态 + 健康等级 |
| GET | `/metrics` | Prometheus 指标 |

## 3. 认证授权

### 3.1 控制面认证

| 方法 | 路径 | 说明 |
|------|------|------|
| POST | `/api/control/auth/login` | 登录签发 JWT |
| GET | `/api/control/auth/me` | 当前用户信息 |

### 3.2 BFF 认证

| 方法 | 路径 | 说明 |
|------|------|------|
| POST | `/api/auth/login` | 管理后台登录 |
| POST | `/api/auth/logout` | 登出 |
| GET | `/api/auth/me` | 当前会话信息 |
| POST | `/api/auth/renew` | 续签 Token |
| GET | `/api/auth/acl` | 权限列表（需会话） |
| GET | `/api/auth/sso/capabilities` | SSO 能力查询 |
| GET | `/api/auth/sso/authorize` | SSO 授权跳转 |
| POST | `/api/auth/sso/bridge-login` | SSO 桥接登录 |
| GET | `/api/auth/matrix-admin-entry` | Matrix 管理入口跳转 |

### 3.3 用户/角色管理

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/api/admin/auth/health` | 认证服务健康 |
| GET | `/api/admin/auth/users` | 用户列表 |
| POST | `/api/admin/auth/users` | 创建用户 |
| POST | `/api/admin/auth/users/:userId` | 更新用户 |
| POST | `/api/admin/auth/users/:userId/delete` | 删除用户 |
| GET | `/api/admin/auth/roles` | 角色列表 |
| POST | `/api/admin/auth/roles` | 创建角色 |
| POST | `/api/admin/auth/roles/:role` | 更新角色 |
| POST | `/api/admin/auth/roles/:role/delete` | 删除角色 |

## 4. 租户实例

### 4.1 控制面 API

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/api/control/instances` | 实例列表（支持 state/tenantId/name/channel 筛选） |
| POST | `/api/control/instances` | 创建实例 |
| GET | `/api/control/instances/:id` | 实例详情 |
| GET | `/api/control/instances/jobs/:requestId` | 异步任务状态查询 |
| POST | `/api/control/instances/:id/start` | 启动 |
| POST | `/api/control/instances/:id/stop` | 停止 |
| POST | `/api/control/instances/:id/rebuild` | 重建 |
| POST | `/api/control/instances/:id/delete` | 删除 |
| POST | `/api/control/instances/batch-actions` | 批量操作（启动/停止/重建/删除） |

### 4.2 BFF 兼容端点

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/api/admin/employees` | 员工列表（BFF 聚合） |
| GET | `/api/admin/employees/:id` | 员工详情 |
| POST | `/api/admin/employees/:id/profile` | 更新基础信息 |
| POST | `/api/admin/employees/:id/policy` | 更新治理策略 |
| POST | `/api/admin/employees/:id/approval-policy` | 更新审批策略 |
| POST | `/api/admin/employees/:id/policy-optimize` | 大模型优化 System Prompt |
| POST | `/api/admin/employees/:id/sync-identity` | 同步身份信息 |
| GET | `/api/admin/instances` | 实例列表 |
| GET | `/api/admin/instances/:id` | 实例详情 |
| POST | `/api/admin/instances/:id/start` | 启动 |
| POST | `/api/admin/instances/:id/stop` | 停止 |
| POST | `/api/admin/instances/:id/rebuild` | 重建 |
| POST | `/api/admin/instances/:id/delete` | 删除 |

## 5. 共享资产

### 5.1 通用资产 API

| 方法 | 路径 | 说明 |
|------|------|------|
| POST | `/api/control/assets/reports` | 上报资产 |
| GET | `/api/control/assets/reports` | 上报列表 |
| GET | `/api/control/assets/reviews/pending` | 待审列表 |
| GET | `/api/control/assets/reviews/dashboard` | 审核工作台 |
| POST | `/api/control/assets/reviews/escalate` | SLA 升级 |
| POST | `/api/control/assets/reviews/batch` | 批量审核 |
| GET | `/api/control/assets/reports/:id/reviews` | 审核历史 |
| POST | `/api/control/assets/reports/:id/reviews` | 提交审核意见 |
| POST | `/api/control/assets/reports/:id/approve` | 通过 |
| POST | `/api/control/assets/reports/:id/reject` | 驳回 |
| GET | `/api/control/assets/shared` | 共享资产列表 |
| POST | `/api/control/assets/bindings` | 绑定 |
| POST | `/api/control/assets/bindings/batch` | 批量绑定 |
| GET | `/api/control/assets/bindings` | 绑定列表 |

### 5.2 技能专用端点

| 方法 | 路径 | 说明 |
|------|------|------|
| POST | `/api/control/skills/reports` | 技能上报 |
| GET | `/api/control/skills/reports` | 技能上报列表 |
| POST | `/api/control/skills/reports/:id/approve` | 技能审批通过 |
| POST | `/api/control/skills/reports/:id/reject` | 技能审批驳回 |
| GET | `/api/control/skills/shared` | 共享技能列表 |
| POST | `/api/control/skills/bindings` | 技能绑定 |
| GET | `/api/control/skills/bindings` | 技能绑定列表 |

### 5.3 BFF 资产管理

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/api/admin/assets/:type` | 按类型列表（skills/tools/knowledge） |
| GET | `/api/admin/assets/:type/:id` | 资产详情 |
| POST | `/api/admin/assets/:type/reports` | 上报 |
| POST | `/api/admin/assets/:type/:id/:action` | 执行操作（approve/reject/publish 等） |

### 5.4 BFF 技能管理

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/api/admin/skills` | 技能列表 |
| GET | `/api/admin/skills/:id` | 技能详情 |
| GET | `/api/admin/skills/employees` | 关联员工 |
| POST | `/api/admin/skills/:id/link` | 绑定员工 |
| POST | `/api/admin/skills/:id/unlink` | 解绑员工 |
| DELETE | `/api/admin/skills/:id` | 删除技能 |
| GET | `/api/admin/skills/export` | 导出 |
| POST | `/api/admin/skills/import` | 导入 |
| GET | `/api/admin/runtime/skill-sedimentation-policy` | 技能沉淀策略 |
| POST | `/api/admin/runtime/skill-sedimentation-policy` | 更新沉淀策略 |

### 5.5 BFF 工具管理

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/api/admin/tools/mcp-services` | MCP 服务列表 |
| POST | `/api/admin/tools/mcp-services` | 创建 MCP 服务 |
| POST | `/api/admin/tools/mcp-services/:id` | 更新 MCP 服务 |
| POST | `/api/admin/tools/mcp-services/:id/check-health` | 健康检查 |
| POST | `/api/admin/tools/mcp-services/:id/delete` | 删除 |
| GET | `/api/admin/tools/pending` | 待审批列表 |
| POST | `/api/admin/tools/mcp-services/:id/:action` | 审批操作（approve/reject/rollback/resubmit） |

### 5.6 BFF 知识/OSS

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/api/admin/oss-findings` | OSS 发现列表 |
| GET | `/api/admin/oss-cases` | OSS 案例列表 |
| GET | `/api/admin/oss-cases/:id` | 案例详情 |
| POST | `/api/admin/oss-cases/:id/:action` | 案例操作 |

## 6. 运行时代理

| 方法 | 路径 | 说明 |
|------|------|------|
| POST | `/api/control/runtime/instances/:id/invoke` | 透过控制面调用租户运行时 |

## 7. 审计

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/api/control/audits` | 审计日志（游标分页 + context/entity/action/operator/time 筛选） |
| GET | `/api/control/audits/export` | 导出（json / ndjson） |
| GET | `/api/control/audits/trace/instances/:instanceId` | 实例审计追踪 |

## 8. Matrix 集成

| 方法 | 路径 | 说明 |
|------|------|------|
| POST | `/api/integrations/matrix/commands` | Matrix 命令 webhook（需 x-matrix-webhook-secret 头） |

## 9. 文档与知识

### 9.1 文档 CRUD

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/api/documents` | 文档列表 |
| POST | `/api/documents` | 创建文档 |
| GET | `/api/documents/:id` | 文档详情 |
| PUT | `/api/documents/:id` | 更新文档 |
| DELETE | `/api/documents/:id` | 删除文档 |

### 9.2 文档高级操作

| 方法 | 路径 | 说明 |
|------|------|------|
| PATCH | `/api/documents/:id/star` | 收藏/取消收藏 |
| POST | `/api/documents/:id/submit-review` | 提交审核 |
| POST | `/api/documents/:id/approve` | 审核通过 |
| POST | `/api/documents/:id/reject` | 审核驳回 |
| POST | `/api/documents/:id/publish` | 发布 |
| POST | `/api/documents/:id/archive` | 归档 |
| GET | `/api/documents/:id/versions` | 版本列表 |
| POST | `/api/documents/versions/:versionId/restore` | 版本回滚 |
| GET | `/api/documents/:id/permissions` | 权限查询 |
| PUT | `/api/documents/:id/permissions` | 权限更新 |

### 9.3 分类管理

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/api/categories` | 分类列表 |
| GET | `/api/categories/:id` | 分类详情 |
| POST | `/api/categories` | 创建分类 |
| PUT | `/api/categories/:id` | 更新分类 |
| DELETE | `/api/categories/:id` | 删除分类 |

### 9.4 知识审计与存储

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/api/knowledge-audits` | 知识审计日志 |
| POST | `/api/uploads` | 文件上传 |
| GET | `/api/uploads/:fileId` | 文件下载 |
| GET | `/api/storage/stats` | 存储统计 |
| GET | `/api/storage/departments` | 部门存储分布 |
| GET | `/api/storage/large-files` | 大文件列表 |

## 10. WeKnora 知识引擎

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/api/weknora/knowledge-bases` | 知识库列表 |
| GET | `/api/weknora/search` | 知识搜索 |
| POST | `/api/weknora/chat` | 知识问答 |
| POST | `/api/weknora/sync-document` | 文档同步 |

## 11. 发布管理

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/api/control/release/preflight` | 发布预检查 |
| POST | `/api/control/release/preflight/assert` | 预检断言 |

## 12. 共享 Agent

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/api/admin/agents/shared` | 共享 Agent 列表 |
| POST | `/api/admin/agents/shared/register` | 注册 Agent |
| POST | `/api/admin/agents/shared/runtime-events` | 运行时事件上报 |
| POST | `/api/admin/agents/shared/:id` | 更新 Agent |
| POST | `/api/admin/agents/shared/:id/delete` | 删除 Agent |
| GET | `/api/admin/agents/shared/recommend` | 推荐 Agent |
| POST | `/api/admin/agents/shared/auto-bind/:employeeId` | 自动绑定 |

## 13. 通知与渠道

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/api/admin/notifications` | 通知列表 |
| GET | `/api/admin/push-channels` | 推送渠道列表 |
| POST | `/api/admin/push-channels` | 创建推送渠道 |
| POST | `/api/admin/push-channels/:id/delete` | 删除渠道 |
| POST | `/api/admin/push-channels/:id/test` | 测试推送 |
| GET | `/api/admin/matrix/channels` | Matrix 频道列表 |
| GET | `/api/admin/matrix/status` | Matrix 连接状态 |
| POST | `/api/admin/matrix/channels/:roomId/bind-instance` | 频道绑定实例 |
| POST | `/api/admin/matrix/channels/:roomId/unbind` | 解绑 |

## 14. 日志与任务

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/api/admin/logs` | 行为日志列表 |
| GET | `/api/admin/tasks` | 任务列表 |
| GET | `/api/admin/tasks/:id` | 任务详情 |
| GET | `/api/admin/tasks/:id/rollback-report` | 回滚报告 |
| GET | `/api/admin/tasks/:id/rollback-package` | 回滚包 |

## 15. AI Gateway

### 15.1 模型管理

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/api/admin/ai-gateway/providers` | 模型提供商列表 |
| GET | `/api/admin/ai-gateway/models` | 模型列表 |
| GET | `/api/admin/ai-gateway/models/:id` | 模型详情 |
| POST | `/api/admin/ai-gateway/models` | 创建模型 |
| POST | `/api/admin/ai-gateway/models/:id/toggle` | 启用/停用 |
| POST | `/api/admin/ai-gateway/models/:id/delete` | 删除模型 |
| POST | `/api/admin/ai-gateway/models/:id/health-check` | 模型健康检查 |
| GET | `/api/admin/ai-gateway/models/:id/health` | 健康状态 |
| POST | `/api/admin/ai-gateway/models/discover` | 自动发现模型 |

### 15.2 负载均衡

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/api/admin/ai-gateway/failover-chains` | 故障转移链列表 |
| POST | `/api/admin/ai-gateway/failover-chains` | 创建 |
| DELETE | `/api/admin/ai-gateway/failover-chains/:id` | 删除 |

### 15.3 调用追踪

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/api/admin/ai-gateway/stats` | 调用统计 |
| GET | `/api/admin/ai-gateway/traces` | 追踪列表 |
| GET | `/api/admin/ai-gateway/traces/:traceId` | 追踪详情 |

### 15.4 成本核算

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/api/admin/ai-gateway/costs` | 成本报表 |
| GET | `/api/admin/ai-gateway/budgets` | 预算列表 |
| POST | `/api/admin/ai-gateway/budgets` | 创建预算 |
| DELETE | `/api/admin/ai-gateway/budgets/:id` | 删除预算 |
| GET | `/api/admin/ai-gateway/budget-status` | 预算执行状态 |

### 15.5 风控规则

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/api/admin/ai-gateway/risk-rules` | 规则列表 |
| POST | `/api/admin/ai-gateway/risk-rules` | 创建规则 |
| POST | `/api/admin/ai-gateway/risk-rules/:ruleId/toggle` | 启用/停用 |
| POST | `/api/admin/ai-gateway/risk-rules/:ruleId/delete` | 删除 |
| POST | `/api/admin/ai-gateway/risk-rules/test` | 规则测试 |
| GET | `/api/admin/ai-gateway/risk-rules/snapshots` | 规则快照列表 |
| POST | `/api/admin/ai-gateway/risk-rules/snapshots/:id/restore` | 快照恢复 |
| POST | `/api/admin/ai-gateway/risk-rules/batch` | 批量操作 |
| GET | `/api/admin/ai-gateway/risk-rules/export` | 规则导出 |
| POST | `/api/admin/ai-gateway/risk-rules/import` | 规则导入 |

### 15.6 决策管理

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/api/admin/ai-gateway/decisions` | 决策列表 |
| GET | `/api/admin/ai-gateway/decisions/:decisionId` | 决策详情 |
| POST | `/api/admin/ai-gateway/decisions` | 创建决策 |
| POST | `/api/admin/ai-gateway/decisions/:decisionId/respond` | 回应决策 |
| POST | `/api/admin/ai-gateway/decisions/trigger` | 触发决策 |

## 16. 平台运营

### 16.1 总览与运行状态

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/api/admin/overview` | 运营总览（实例/资产/审计/权限统计） |
| GET | `/api/admin/runtime-status` | 运行时状态 |
| GET | `/api/admin/bootstrap-status` | 启动引导状态 |
| GET | `/api/framework` | 框架信息 |
| GET | `/api/metrics` | 指标数据 |

### 16.2 OpenClaw 配置

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/api/admin/runtime/openclaw-config` | 当前配置 |
| POST | `/api/admin/runtime/openclaw-config` | 更新配置 |
| GET | `/api/admin/runtime/openclaw-config/snapshots` | 配置快照列表 |
| POST | `/api/admin/runtime/openclaw-config/snapshots/:id/restore` | 恢复快照 |
| GET | `/api/admin/runtime/openclaw-config/snapshots/:id1/diff/:id2` | 快照差异对比 |

### 16.3 分析指标

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/api/admin/analytics/log-stats` | 日志统计 |
| GET | `/api/admin/analytics/agent-performance` | Agent 性能 |
| GET | `/api/admin/analytics/alerts` | 告警列表 |
| GET | `/api/admin/analytics/health` | 健康指标 |
| GET | `/api/admin/analytics/dau-trend` | DAU 趋势 |
| GET | `/api/admin/analytics/latency-trend` | 延迟趋势 |
