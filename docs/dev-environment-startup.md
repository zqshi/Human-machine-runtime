# HMR 本地开发环境启动指南

> 实现态文档，与代码同步。本文记录**实测的完整本地环境**启动/停止方式，覆盖应用进程 + 全部基础设施容器。
> README "启动步骤"章节是**最小开发启动**（仅 postgres + server + web，够跑核心业务），本文是**全链路本地环境**（含 IM/WeKnora/可观测性），两者面向不同场景，互补。
>
> 实测时间：2026-06-29。环境以容器 `com.docker.compose.project` 标签为准确认来源。

---

## 一、环境组成总览

本地环境由**三套 docker-compose + 应用进程**拼装，分属不同 compose 项目：

| 来源 compose | compose 项目名 | 管理的服务 | 端口 |
| --- | --- | --- | --- |
| `docker-compose.yml`（根） | `human-machine-runtime` | postgres、redis、litellm、hmr-server、hmr-web、conduit、weknora(profile) | 5435 / 6379 / 4000 / 3002 / 8080 / 6167 / 8088 |
| `deploy/local/docker-compose.openclaw-matrix.yml` | `local` | matrix-synapse、openclaw-gateway、matrix-element-web、weknora-pg/redis/docreader/app/ui | 8008 / 18789-18790 / 8081 / 19000-19001 |
| `deploy/observability/docker-compose.yml` | `observability` | prometheus、alertmanager、grafana | 9090 / 9093 / 3001 |
| 应用进程（npm） | — | server、web dev server | 3002 / 5173 |

**坑点（实测与 README/声明不一致，启动前必知）：**

1. **Matrix 服务器实际用 Synapse 不是 Conduit**。根 `docker-compose.yml` 声明的是 `matrixconduit/matrix-conduit`(端口 6167)，README 也写 Conduit，但**实测运行的是 Synapse**(端口 8008，来自 `deploy/local/docker-compose.openclaw-matrix.yml`)。IM 功能实际依赖 Synapse，不是 Conduit。
2. **WeKnora 来源分裂**。实际有两组 WeKnora 相关容器：
   - `deploy/local/...openclaw-matrix.yml` 的 `hmr-weknora-*`（app/ui/docreader/redis/pg，镜像 `wechatopenai/weknora-*`，对应腾讯开源 `Tencent/WeKnora`）—— 属 HMR。
   - `WeKnora-neo4j` —— compose 项目名 `weknora`，来自**仓库外独立项目** `/Users/zqs/Downloads/project/WeKnora/docker-compose.yml`，非 HMR 本仓库管理。WeKnora 本身用 pgvector 做向量存储（不依赖 neo4j），这个 neo4j 容器是否随 HMR 起取决于 WeKnora 独立项目部署，**HMR 启动文档不对其负责**。
3. **WeKnora env 必传 DB_DRIVER / RETRIEVE_DRIVER**。`deploy/local` compose 的 weknora-app 必须 `DB_DRIVER: postgres` + `RETRIEVE_DRIVER: postgres`——缺任一 WeKnora `initDatabase` 读空 driver 直接 panic 崩溃重启（对齐 `Tencent/WeKnora` 官方 .env.example）。Redis 用 `REDIS_ADDR`（非 REDIS_HOST）。当前 compose 已补全。
4. **WeKnora 端口随部署方式变，.env 须对齐**。`deploy/local` 部署 weknora-app 映射 **19000**（非根 compose profile 的 8088）。`server/.env` 的 `WEKNORA_API_URL` 须设 `http://localhost:19000`，否则 WeKnoraClient 请求打到无人监听的死端口。
5. **LiteLLM 用 profile 控制**。根 compose 的 litellm 带 profiles(litellm/full)，`docker compose up -d` 默认不起，需 `--profile litellm` 或 `--profile full`。

---

## 二、启动（全链路）

### 2.1 基础设施容器

按需起，三套 compose 独立启动（各自一个 compose 项目）：

```bash
# A. 核心数据库 + 缓存（必起）— postgres:5435 / redis:6379
docker compose up -d postgres redis

# A2. LiteLLM 模型代理（可选，Agent 执行需 LLM 时起）— :4000
docker compose --profile litellm up -d

# B. IM 基础设施 — Synapse:8008 / Element:8081 / cockpit网关:18789-18790
cd deploy/local
docker compose -f docker-compose.openclaw-matrix.yml up -d
cd ../..

# C. 可观测性（可选）— Prometheus:9090 / Grafana:3001
cd deploy/observability
docker compose up -d
cd ../..
```

> `deploy/local/docker-compose.openclaw-matrix.yml` 一次起 7 个容器（matrix 三件 + weknora 五件 minus 共享 redis/pg）。IM 与 WeKnora 同属 `local` 项目，无法只起其中一组——若只要 IM 不要 WeKnora，需手动 `docker compose -f ... up -d matrix-synapse matrix-element-web openclaw-gateway` 指定服务名。

### 2.2 应用进程

容器起好后起应用：

```bash
# 1. 安装依赖（首次）
npm install
cd server && npm install && cd ..
cd client-suite/apps/web && npm install && cd ../../..

# 2. 配置环境变量
cd server && cp .env.example .env   # 按需编辑（DB/LLM/外部网关）
cd ..

# 3. 初始化数据库（建表 + 种子数据，postgres 必须已起）
npm run db:setup

# 4. 启动后端（dev 模式，tsx watch 热重载，:3002）
npm run dev

# 5. 启动前端（另开终端，vite dev server，:5173）
cd client-suite/apps/web && npx vite
```

### 2.3 访问入口

| 入口 | URL | 前置 |
| --- | --- | --- |
| 用户端 SPA | http://127.0.0.1:5173/ | web dev server |
| 管理后台 | http://127.0.0.1:5173/admin | web dev server |
| 运营平台 | http://127.0.0.1:5173/ops | web dev server |
| API 服务 | http://127.0.0.1:3002/ | server |
| 健康检查 | http://127.0.0.1:3002/health | server |
| Matrix Element Web | http://127.0.0.1:8081/ | Synapse(:8008) |
| WeKnora UI | http://127.0.0.1:19001/ | weknora 套件 |
| LiteLLM 管理 | http://127.0.0.1:4000/ | LiteLLM |
| Grafana | http://127.0.0.1:3001/ (admin/admin) | observability |

> vite dev server 自动代理 `/api` → 后端 3002。Matrix Element Web 是独立容器(:8081)，不经 vite 代理。

---

## 三、停止（全链路）

### 3.1 停应用进程

应用进程是 node（`npm run dev` / `npx vite`），Ctrl+C 停对应终端即可。若进程脱离终端，按端口查 PID：

```bash
lsof -nP -iTCP:3002 -iTCP:5173 -sTCP:LISTEN   # 查 server / web 的 PID
kill <PID>
```

### 3.2 停容器

三套 compose 分别停（`down` 保留数据卷，数据不丢）：

```bash
# A. 核心（postgres/redis/litellm）
docker compose down                          # 仅停无 profile 的（postgres/redis）
docker compose --profile litellm down        # 连同 litellm

# B. IM + WeKnora 套件（local 项目）
cd deploy/local
docker compose -f docker-compose.openclaw-matrix.yml down
cd ../..

# C. 可观测性
cd deploy/observability
docker compose down
cd ../..
```

> **注意根 compose 的 down 行为**：根 `docker-compose.yml` 只把 postgres/redis/litellm 算进默认项目。Matrix/WeKnora/openclaw-gateway 在 `local` 项目里——停根 compose **不会**带走它们，必须单独 down `deploy/local` 那套。这是历史踩过的坑：以为 `docker compose down` 能停全部，结果 Matrix/WeKnora 仍在跑。
>
> `WeKnora-neo4j` 属仓库外独立项目，停止/启动由 WeKnora 项目自己管，HMR 不负责。

### 3.3 一键查端口/容器状态

```bash
# 查 HMR 相关端口是否还在监听
lsof -nP -iTCP:3002 -iTCP:4000 -iTCP:5173 -iTCP:5435 -iTCP:8008 -iTCP:8081 -iTCP:18789 -sTCP:LISTEN

# 查运行中容器
docker ps --format "table {{.Names}}\t{{.Ports}}\t{{.Status}}"
```

---

## 四、端口清单（实测）

| 端口 | 服务 | 来源 |
| --- | --- | --- |
| 3002 | HMR server（Hono） | npm `npm run dev` |
| 5173 | web dev server（vite） | `npx vite` |
| 5435 | postgres（HMR 主库） | 根 compose |
| 6379 | redis | 根 compose |
| 4000 | LiteLLM | 根 compose（profile litellm） |
| 8008 | Matrix Synapse | local compose |
| 8081 | Matrix Element Web | local compose |
| 18789-18790 | cockpit 网关（openclaw:local） | local compose |
| 19000 | WeKnora app | local compose |
| 19001 | WeKnora ui | local compose |
| 9090 / 9093 / 3001 | Prometheus / Alertmanager / Grafana | observability compose |

**非 HMR（勿误停/勿纳入 HMR 启动）：**

| 端口 | 服务 | 说明 |
| --- | --- | --- |
| 8000 | v2-openhands-1 | 另一项目 BuildWise/v2，独立 compose |
| 7474 / 7687 | WeKnora-neo4j | 仓库外 WeKnora 独立项目 |

---

## 五、数据卷与恢复

- 三套 compose 的 `down` 均保留命名卷（`pgdata`、`weknora-pg-data`、`prometheus-data` 等），数据持久。
- 恢复 = 重跑 §2 启动命令，卷自动挂回，无需重新 `db:setup`。
- **彻底清数据**（慎用）：`docker compose down -v` 删除对应卷。仅在确认要重置数据库/缓存时用。
