> ⚠️ **历史文档快照**（非当前实现）：本文档为早期架构/规划/PRD 记录，部分内容已被后续演进取代。当前实现以 `server/src` + `client-suite/apps/web/src` 代码为准（28 个限界上下文 · Hono/TS/Drizzle · PostgreSQL@5435）。

# HMR 生产化升级总纲 v2

> 目标：将 HMR 从原型系统升级为企业 AI 数字员工平台的生产底座
> 约束：对接的三个既有生产系统（企业平台 Monorepo / 实例编排 / AI 工作区）零修改

## 项目定位

HMR = 企业 AI 数字员工平台生产底座，包含：
- **运管平台** (hmr-ops-be)：租户管理、资源配额、平台监控
- **管理控制面** (hmr-admin-be)：数字员工管理、技能/工具/模型配置
- **AI Gateway** (hmr-ai-gateway)：模型代理、风控、追踪、成本
- **用户端** (apps/web)：IM 通道 + 决策中心 + 知识管理 + 应用

## 生产环境现状

| 项目（组件代号） | 角色 | 技术栈 |
|------|------|--------|
| 企业平台 Monorepo（ks-claw） | 平台 Monorepo，含技能市场/配置中心/平台后端 | Python(FastAPI) + Go + TS(Hono) + MySQL + PG |
| 实例编排（claw-farm） | IM 网关 + K8s 编排 | Go + TS(Cockpit Channel) |
| AI 工作区（xspace） | AI 应用生成 | Python(FastAPI) + MySQL + Prisma + K8s |

## HMR 当前技术债

- 后端 Node.js/CommonJS → 需迁移 Python/FastAPI
- SQLite → 需迁移 MySQL + PostgreSQL
- 本地密码认证 → 需接入 OAuth/OIDC
- Mock 数据 → 需对接生产 API
- Vanilla JS 管理页 → 需重写 React

## 核心原则

1. 功能零丢失：HMR 138 个后端模块 + 448 个前端文件全部保留或升级
2. 生产零改动：通过 API 代理模式集成三个生产项目
3. 技术栈对齐：Python/FastAPI + MySQL/PG + K8s/Helm
4. 渐进式迁移：旧后端可并行运行直到新后端完全替代
