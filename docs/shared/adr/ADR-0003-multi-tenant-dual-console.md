# ADR-0003: Multi-Tenant Dual Console Architecture

## Status
Accepted

## Context

DCF 平台需要支持多租户：平台运营方开通租户，每个租户管理员管理各自的员工实例、技能、工具等资源。

当前系统是完全的单租户模型：
- `Instance.tenantId` 是 per-instance 自动生成的随机 ID，不是组织级租户标识。
- `AuthService` 的用户/角色无租户归属，JWT 中无 tenantId。
- 所有数据查询返回全量，无租户过滤。
- 管理后台（admin-ui）所有页面展示全量数据。

### 核心决策点

**是否需要单独构建超级管理后台？**

## Decision

**采用双控制台架构**：超级管理后台与租户管理后台完全分离。

### 选型理由

| 方案 | 优势 | 劣势 |
|------|------|------|
| **A: 双控制台（选定）** | 职责清晰，安全边界严格，互不影响 | 需要新建一套前端页面 |
| B: 单控制台 + 权限门控 | 代码复用高 | 权限判断复杂，平台/租户逻辑耦合 |
| C: 完全独立部署 | 隔离最彻底 | 运维复杂度翻倍，共享服务层困难 |

选择方案 A 的核心判断：

1. **定位不同，功能不重叠**：超级管理后台管的是"租户生命周期/资源配额/跨租户监控"，租户管理后台管的是"员工实例/技能工具/日志审计"——这是两个完全不同的业务领域。
2. **安全边界严格**：双域 JWT（scope=platform / scope=tenant），中间件互斥，租户用户无法触达平台 API。
3. **故障隔离**：超级管理后台故障不影响租户管理后台，反之亦然。
4. **同一进程共享服务**：两套前端共享 Express 后端服务层和 CSS 框架，不需要独立部署。

### 架构要点

1. **URL 隔离**: `/super-admin/*` vs `/admin/*`, `/api/platform/*` vs `/api/admin/*`
2. **认证隔离**: 双域角色（PLATFORM_ROLES / TENANT_ROLES），双登录入口，JWT scope 字段互斥
3. **数据隔离**: Repository 层所有 list 方法增加 tenantId 过滤，tenant BFF 从 JWT 强制注入
4. **新限界上下文**: `tenant-management`（Tenant 实体 + TenantService）
5. **Instance.tenantId 语义修正**: 从 per-instance auto-generate 改为组织级 required input

## Consequences

### Positive
- 平台运营与租户运营完全解耦，各自独立演进。
- 安全模型简单明确：平台用户只能走平台 API，租户用户只能走租户 API。
- 现有管理后台改动最小化——主要是认证层注入 tenantId + 移除平台级页面。

### Negative
- 需要新建超级管理后台 7 个页面（~14 个 HTML/JS 文件）。
- 共享 CSS 需要提取到公共目录，初期有迁移成本。
- `auth-core.js` 和 `super-auth-core.js` 存在一定代码重复（已评估，两者侧栏/品牌/API 路径差异较大，强行合并反而增加复杂度）。

## Follow-ups
- Phase 1（后端基础设施）进行中：Tenant 实体已创建，待完成 AuthService 重构 + Repository 隔离。
- Phase 2-3（前端双控制台）待后端就绪后启动。
