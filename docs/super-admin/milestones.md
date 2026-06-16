# 租户运营平台 — 里程碑计划

> 版本 1.1 | 2026-04-15

## M0: 后端基础设施 [已完成]

- [x] 新建 `tenant-management` 限界上下文（Tenant 实体 + TenantService）
- [x] Tenant 四维度配额模型（14 字段：容量/实例资源/AI 用量/数据策略）
- [x] Instance.tenantId 语义修正（从 auto-generate 改为组织级必传）
- [x] AuthService 双域角色体系（platform / tenant）
- [x] JWT 增加 scope + tenantId 字段
- [x] 认证中间件分离（platformAuth / tenantAuth）
- [x] ControlPlaneRepository 数据隔离（所有 list 方法增加 tenantId 过滤）
- [x] Platform API 路由（认证 + 租户 CRUD + 监控 + 审计 + 配置 + 用户）
- [x] 现有 BFF 路由租户隔离改造
- [x] 数据迁移脚本（创建 default 租户 + 关联现有实例）
- [x] 测试覆盖（tenant-domain.test.js + tenant-service.test.js）

**交付物**: 多租户后端基础设施就绪，双域认证 + 数据隔离 + Platform API 全量可用。

## M1: 租户运营平台前端 [已完成]

- [x] 创建 `super-admin-ui/` 目录
- [x] 实现 `super-auth-core.js`（认证基础设施 + 侧栏渲染 + 分页）
- [x] `super-admin-base.css`（统一表单控件样式）
- [x] 平台登录页
- [x] 租户管理页（列表 + 生产级创建 Drawer + 编辑 Drawer + 状态流转）
- [x] 创建 Drawer：套餐选卡 + 14 字段配额自动填充 + 功能开关 + 模型访问 + 初始管理员
- [x] 平台用户管理页（CRUD + 动态/env 用户合并）
- [x] 运营监控页（资源总览卡片 + 租户配额利用率进度条 + 健康状态）
- [x] 全局配置页（可编辑运行时配置 + 只读 Provider/K8s）
- [x] 跨租户审计页
- [x] createServer.js 注册 `/super-admin` 路由 + 静态文件白名单
- [x] 全部页面品牌标识统一为"租户运营平台"

**交付物**: 租户运营平台 6 页全量上线，生产级租户配额管理。

## M2: 租户管理后台改造 [规划中]

- 登录页增加租户选择（slug 输入 / 下拉选择）
- auth-core.js 注入租户上下文
- 移除平台级页面（monitor 迁移到运营平台）
- auth-members.html 改为租户内用户管理
- 所有页面数据自动租户隔离验证

**交付物**: 现有管理后台完成租户化改造，数据隔离到位。

## M3: K8s 多租户隔离 + 高级特性 [规划中]

- OpenClawProvisioner namespace 策略改为 per-tenant
- 租户暂停 → 批量停止所有实例
- 配额校验（创建实例时检查 maxInstances / maxUsers）
- 租户级 AI Gateway 预算隔离
- 租户级审计日志隔离
- 租户自助注册流程

**交付物**: 生产级多租户隔离，配额管控 + K8s 命名空间隔离。
