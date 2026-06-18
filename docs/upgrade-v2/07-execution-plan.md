> ⚠️ **历史文档快照**（非当前实现）：本文档为早期架构/规划/PRD 记录，部分内容已被后续演进取代。当前实现以 `server/src` + `client-suite/apps/web/src` 代码为准（28 个限界上下文 · Hono/TS/Drizzle · PostgreSQL@5435）。

# 执行计划 — 详细任务拆解

## Phase 0: 基础设施对齐 (32 tasks)

### 0.1 Monorepo 结构 (8 tasks)
- [P0-01] 创建 apps/ 目录，git mv client-suite/apps/web → apps/web
- [P0-02] 更新 apps/web 中所有 import 路径（tsconfig paths, vite alias）
- [P0-03] 创建 service/ 目录及 4 个子服务初始骨架（main.py + pyproject.toml）
- [P0-04] 创建 packages/ 目录及 3 个子包骨架
- [P0-05] 创建根 pyproject.toml（uv workspace members）
- [P0-06] 更新 pnpm-workspace.yaml（apps/*, packages/*, service/*）
- [P0-07] 创建 .python-version (3.12)
- [P0-08] 验证 pnpm install + uv sync + apps/web dev 正常

### 0.2 数据库 Schema (10 tasks)
- [P0-09] 创建 packages/db/prisma/schema.prisma（对齐企业平台 Monorepo（ks-claw）+ HMR 扩展）
- [P0-10] 编写 User, PlatformSession, AuthProvider 等认证相关 model
- [P0-11] 编写 Tenant, TenantMembership model
- [P0-12] 编写 DigitalEmployee model
- [P0-13] 编写 LlmModel, RiskRule model
- [P0-14] 编写 AiTrace, CostRecord model
- [P0-15] 编写 Instance model
- [P0-16] 创建 packages/db/.env.example + prisma generate 验证
- [P0-17] 创建 packages/db-pg/ Drizzle schema（审计/监控/配额表）
- [P0-18] 编写数据库初始化脚本（创建库 + 迁移）

### 0.3 共享认证包 (8 tasks)
- [P0-19] 创建 packages/shared/src/auth/__init__.py
- [P0-20] 实现 PlatformAuthClient.verify_session()
- [P0-21] 实现 get_current_user FastAPI 依赖
- [P0-22] 实现 mock auth 模式（AUTH_MODE=mock 时跳过验证）
- [P0-23] 编写 packages/shared/src/auth/ 单元测试
- [P0-24] 实现 tenant context 注入（从 user → tenant 映射）
- [P0-25] 实现 role-based access control 装饰器
- [P0-26] 验证 auth 模块可被各 service 引用

### 0.4 Charts 骨架 (6 tasks)
- [P0-27] 创建 charts/hmr-admin-be/ 模板
- [P0-28] 创建 charts/hmr-ops-be/ 模板
- [P0-29] 创建 charts/hmr-ai-gateway/ 模板
- [P0-30] 创建 charts/hmr-inrouter/ 模板
- [P0-31] 创建 deploy/helmfile.yaml
- [P0-32] 创建 deploy/manifests/secrets/ 结构

## Phase 1: 管理控制面后端 (28 tasks)

### 1.1 hmr-admin-be 核心 (14 tasks)
- [P1-01] 实现 app/main.py（FastAPI app + lifespan + CORS + error handlers）
- [P1-02] 实现 app/config/settings.py（pydantic-settings）
- [P1-03] 实现 app/deps.py（DB 连接 + auth 注入 + tenant context）
- [P1-04] 实现 employees.py CRUD（GET/POST/PUT/DELETE + 分页）
- [P1-05] 实现 skills.py（代理 clawhub API，含列表/详情/安装/策略）
- [P1-06] 实现 tools.py CRUD + approvals
- [P1-07] 实现 models.py CRUD + discover（对接 LiteLLM /models 端点）
- [P1-08] 实现 risk_rules.py CRUD
- [P1-09] 实现 instances.py（K8s API 查询 Pod 状态 + 统计）
- [P1-10] 实现 members.py CRUD（租户成员管理）
- [P1-11] 实现 analytics.py（Token/成本/调用统计聚合查询）
- [P1-12] 实现 logs.py（PG 审计日志查询 + 筛选）
- [P1-13] 实现 shared_agents.py（代理 clawhub agents API）
- [P1-14] 实现 notifications.py

### 1.2 Service 层 (6 tasks)
- [P1-15] 实现 clawhub_client.py（httpx 异步客户端 + 错误处理）
- [P1-16] 实现 claw_farm_client.py（K8s API + label 查询）
- [P1-17] 实现 xspace_client.py（httpx 异步客户端）
- [P1-18] 实现 litellm_client.py（LiteLLM 管理 API）
- [P1-19] 实现 employee_service.py（业务逻辑编排）
- [P1-20] 实现 notification_service.py

### 1.3 测试 (4 tasks)
- [P1-21] 编写 test_employees.py（CRUD + 分页）
- [P1-22] 编写 test_skills.py（代理逻辑 + mock clawhub）
- [P1-23] 编写 test_models.py（CRUD + discover）
- [P1-24] 编写 test_risk_rules.py

### 1.4 管理前端重写 (4 tasks)
- [P1-25] 实现 adminApi.ts 客户端
- [P1-26] 重写 EmployeesSection.tsx + SkillsSection.tsx + ToolsSection.tsx
- [P1-27] 重写 AIGatewaySection.tsx + InstancesSection.tsx
- [P1-28] 重写 LogsSection.tsx + AuthSection.tsx + 其余 Section

## Phase 2: 运管平台后端 (18 tasks)

### 2.1 hmr-ops-be 核心 (10 tasks)
- [P2-01] 实现 app/main.py + settings + deps
- [P2-02] 实现 tenants.py CRUD + 分页 + 搜索
- [P2-03] 实现 tenants quotas 管理
- [P2-04] 实现 platform_config.py（全局配置 CRUD）
- [P2-05] 实现 platform_monitoring.py（概览/服务状态/资源）
- [P2-06] 实现 platform_users.py（全平台用户管理）
- [P2-07] 实现 platform_audit.py（审计日志 + 导出）
- [P2-08] 实现 quotas.py（配额模板管理）
- [P2-09] 实现 monitoring_service.py（K8s metrics 采集）
- [P2-10] 实现 tenant_service.py + quota_service.py

### 2.2 测试 (4 tasks)
- [P2-11] 编写 test_tenants.py
- [P2-12] 编写 test_monitoring.py
- [P2-13] 编写 test_users.py
- [P2-14] 编写 test_audit.py

### 2.3 运管前端 (4 tasks)
- [P2-15] 实现 opsApi.ts 客户端
- [P2-16] 重写 TenantsSection.tsx（CRUD + 配额）
- [P2-17] 重写 PlatformMonitoringSection.tsx + PlatformConfigSection.tsx
- [P2-18] 新增 PlatformAuditSection.tsx + 重写 PlatformUsersSection.tsx

## Phase 3: AI Gateway 迁移 (30 tasks)

### 3.1 核心框架 (4 tasks)
- [P3-01] 实现 app/main.py + settings + deps
- [P3-02] 实现 app/api/v1/router.py（汇总所有路由）
- [P3-03] 实现 WebSocket 连接管理器
- [P3-04] 实现 健康检查 + 中间件

### 3.2 Agent Domain 迁移 (8 tasks)
- [P3-05] 迁移 AgentExecutor.js → executor.py + test
- [P3-06] 迁移 IntentRouter.js → intent_router.py
- [P3-07] 迁移 EscalationEngine.js → escalation.py
- [P3-08] 迁移 CorrectionExecutor.js → correction.py
- [P3-09] 迁移 TaskContract.js → task_contract.py
- [P3-10] 迁移 StrategicDecoder.js → strategic_decoder.py
- [P3-11] 迁移 AgentSimulator.js → simulator.py + test
- [P3-12] 迁移 AgentPerformanceStore.js → performance.py

### 3.3 LLM + 风控 (6 tasks)
- [P3-13] 实现 llm/client.py（多 provider + LiteLLM 双模式）
- [P3-14] 实现 llm/risk_scanner.py（风控规则引擎）
- [P3-15] 实现 llm/cost_calculator.py（成本计算 + 汇率）
- [P3-16] 实现 gateway.py 路由（模型代理 + 风控拦截 + 追踪）
- [P3-17] 实现 analytics.py（统计 API）
- [P3-18] 实现 models.py（模型发现 API）

### 3.4 K8s + OpenClaw (4 tasks)
- [P3-19] 迁移 OpenClawProvisioner.js → k8s/provisioner.py
- [P3-20] 实现 openclaw.py（实例管理 API）
- [P3-21] 实现 objectives.py（目标/判断 API）
- [P3-22] 实现 collaboration.py（协作 API）

### 3.5 其他 API (4 tasks)
- [P3-23] 实现 runtime.py（运行时管理）
- [P3-24] 实现 knowledge.py（知识管理 API）
- [P3-25] 实现 websocket.py（用户端 WebSocket 通道）
- [P3-26] 迁移 integrations（weknora, matrix_relay）

### 3.6 测试 (4 tasks)
- [P3-27] 编写 test_executor.py（对齐 AgentExecutor.test.js 用例）
- [P3-28] 编写 test_simulator.py（对齐 AgentSimulator.test.js 用例）
- [P3-29] 编写 test_llm_client.py（对齐 LLMClient.test.js 用例）
- [P3-30] 编写 test_gateway.py（风控+追踪+成本 集成测试）

## Phase 4: 用户端集成 (20 tasks)

### 4.1 认证升级 (4 tasks)
- [P4-01] 重写 authStore.ts（OAuth 流程 + session check）
- [P4-02] 实现 AuthGuard 路由守卫
- [P4-03] 实现 LoginPage.tsx 升级（OAuth 跳转 + 加载态）
- [P4-04] 所有 API 请求添加 credentials: 'include'

### 4.2 IM 通道 (6 tasks)
- [P4-05] 实现 HmrWebSocketClient.ts（IMatrixClient 适配器）
- [P4-06] 实现 createMatrixClient 工厂（mode 切换）
- [P4-07] 升级 useMatrixClient hook（支持新工厂）
- [P4-08] 升级 chatStore（支持真实消息流）
- [P4-09] 升级 RoomList + ChatPane（支持真实 Agent 会话）
- [P4-10] 验证消息收发全链路

### 4.3 数据对接 (6 tasks)
- [P4-11] 实现 apiGateway.ts 升级（真实 API 端点）
- [P4-12] 实现 xspaceApi.ts 客户端
- [P4-13] 升级 agentStore（clawhub agents API）
- [P4-14] 升级 AgentsHub.tsx + SkillsCenter.tsx（真实数据）
- [P4-15] 升级 AppCenterPage.tsx（xspace apps）
- [P4-16] 升级 OpenClaw 决策中心各面板（真实数据）

### 4.4 验证 (4 tasks)
- [P4-17] E2E 测试：登录 → 首页 → 各功能页面
- [P4-18] E2E 测试：IM 消息收发
- [P4-19] E2E 测试：管理后台操作
- [P4-20] Mock 模式回归验证

## Phase 5: 网关与部署 (16 tasks)

### 5.1 Nginx (4 tasks)
- [P5-01] 编写 nginx.conf（完整路由规则）
- [P5-02] 编写 entrypoint.sh（环境变量替换）
- [P5-03] 编写 Dockerfile
- [P5-04] 本地验证路由正确性

### 5.2 Docker (4 tasks)
- [P5-05] 编写 hmr-admin-be Dockerfile
- [P5-06] 编写 hmr-ops-be Dockerfile
- [P5-07] 编写 hmr-ai-gateway Dockerfile
- [P5-08] 编写 docker-compose.dev.yaml（本地开发全栈）

### 5.3 Helm Charts (4 tasks)
- [P5-09] 完善 charts/hmr-admin-be/（deployment + service + configmap）
- [P5-10] 完善 charts/hmr-ops-be/
- [P5-11] 完善 charts/hmr-ai-gateway/
- [P5-12] 完善 charts/hmr-inrouter/

### 5.4 部署验证 (4 tasks)
- [P5-13] helm template 全部渲染无报错
- [P5-14] docker-compose up 全栈启动
- [P5-15] 创建 deploy/manifests/secrets/ 模板
- [P5-16] 更新 deploy/helm/human-machine-runtime/（或替换为 helmfile）

## 总计: 144 tasks
- Phase 0: 32 tasks (基础设施)
- Phase 1: 28 tasks (管理控制面)
- Phase 2: 18 tasks (运管平台)
- Phase 3: 30 tasks (AI Gateway)
- Phase 4: 20 tasks (用户端集成)
- Phase 5: 16 tasks (部署)
