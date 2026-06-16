# Phase 0：基础设施对齐

> 代号说明：本文中 `ks-claw`（企业平台 Monorepo）、`clawhub`（技能市场）、`portal`/`portal-backend`（配置中心）、`xspace`（AI 工作区）、`claw-farm`（实例编排）均为**可替换的系统组件代号**，企业接入时替换为自有同类系统。

## 目标
建立 Monorepo 结构、数据库 schema、认证对接——让新服务能启动。

## 0.1 Monorepo 结构重组

### 目标结构
```
dcf-light-bot/
├── apps/
│   └── web/                          # client-suite 迁入
├── service/
│   ├── dcf-admin-be/                 # 管理控制面 (FastAPI)
│   ├── dcf-ops-be/                   # 运管平台 (FastAPI)
│   ├── dcf-ai-gateway/              # AI Gateway (FastAPI)
│   └── dcf-inrouter/                # Nginx 网关
├── packages/
│   ├── db/                           # Prisma schema (MySQL)
│   ├── db-pg/                        # Drizzle schema (PostgreSQL)
│   └── shared/                       # 跨服务共享 Python 包
├── charts/
│   ├── dcf-admin-be/
│   ├── dcf-ops-be/
│   ├── dcf-ai-gateway/
│   └── dcf-inrouter/
├── deploy/
│   ├── manifests/secrets/
│   └── helmfile.yaml
├── src/                              # 旧后端（保留，逐步迁移后删除）
├── docs/
├── scripts/
├── pyproject.toml                    # uv workspace root
├── pnpm-workspace.yaml
└── CLAUDE.md
```

### 执行步骤
1. 创建 `apps/` 目录，将 `client-suite/apps/web/` git mv 到 `apps/web/`
2. 创建 `service/` 目录及四个子服务骨架
3. 创建 `packages/` 目录及三个子包
4. 创建 `charts/` 目录
5. 创建根 `pyproject.toml` (uv workspace)
6. 更新 `pnpm-workspace.yaml`
7. 创建 `.python-version` → 3.12
8. 更新前端 import 路径和 vite.config.ts

## 0.2 数据库 Schema

### MySQL (packages/db/)

复用企业平台 Monorepo（ks-claw）platform-be 的 Prisma schema，扩展管理域：

**对齐表**（与企业平台 Monorepo 字段 1:1 兼容）：
- User, PlatformSession, AuthProvider, UserAuthorization
- CredentialSecret, CredentialLease, OAuthState, UserApiToken

**新增表**（DCF 管理域）：
- Tenant：租户管理
- TenantMembership：租户成员
- DigitalEmployee：数字员工实体
- LlmModel：LLM 模型配置（从 SQLite 升级）
- RiskRule：风控规则（从 SQLite 升级）
- AiTrace：AI 追踪记录（从 SQLite 升级）
- CostRecord：成本记录（从 SQLite 升级）
- Instance：OpenClaw 实例状态

### PostgreSQL (packages/db-pg/)

使用 Drizzle ORM，对齐企业平台 Monorepo 的技能市场（clawhub）/配置中心（portal-backend）风格：
- platformAuditLogs：平台审计日志
- platformMetrics：平台监控指标
- quotaUsage：配额使用

## 0.3 认证对接

### 认证流程
```
用户 → DCF Web → /api/v1/auth/login → 302 企业 OAuth (OIDC)
→ 企业 IdP 授权 → 回调 /api/v1/auth/callback
→ platform-be 创建/更新 User + Session
→ Set-Cookie: session_token
→ 后续请求: Cookie → 各后端验证
```

### 共享认证模块 (packages/shared/src/auth/)
- `platform_auth.py`：PlatformAuthClient 类
  - `verify_session(token)` → GET platform-be /api/v1/auth/me
  - `get_current_user` FastAPI 依赖注入

### 兼容方案
- 开发环境支持 mock auth（环境变量 `AUTH_MODE=mock`）
- 生产环境强制 OAuth

## 0.4 验证标准
- [ ] `uv sync` 成功安装所有 Python 依赖
- [ ] `pnpm install` 成功安装所有前端依赖
- [ ] `apps/web/` 能正常 `pnpm dev` 启动
- [ ] `packages/db/` 能 `prisma generate` 成功
- [ ] 各 service 能 `uv run python -m app.main` 启动（空壳）
