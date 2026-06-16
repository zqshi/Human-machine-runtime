> ⚠️ **历史文档快照**（非当前实现）：本文档为早期架构/规划/PRD 记录，部分内容已被后续演进取代。当前实现以 `server/src` + `client-suite/apps/web/src` 代码为准（28 个限界上下文 · Hono/TS/Drizzle · PostgreSQL@5432）。

# Phase 5：网关与部署

## 目标
完成 Nginx 网关配置和 Helm Charts，使 HMR 可部署到 K8s 集群。

## 5.1 hmr-inrouter (Nginx)

### 目录结构
```
service/hmr-inrouter/
├── nginx.conf
├── entrypoint.sh
├── Dockerfile
└── README.md
```

### Nginx 配置
```nginx
worker_processes auto;
events { worker_connections 1024; }

http {
    include       mime.types;
    default_type  application/octet-stream;
    sendfile      on;
    
    # 上游服务（环境变量注入实际地址；下方为各组件业务职责）
    upstream platform_be    { server ${PLATFORM_BE_HOST}:8000; }      # 平台后端
    upstream hmr_admin_be   { server ${HMR_ADMIN_BE_HOST}:8000; }     # 管理控制面
    upstream hmr_ops_be     { server ${HMR_OPS_BE_HOST}:8000; }       # 运管平台
    upstream hmr_ai_gateway { server ${HMR_AI_GATEWAY_HOST}:8000; }   # AI Gateway
    upstream clawhub        { server ${CLAWHUB_HOST}:3000; }          # 技能市场
    upstream portal_be      { server ${PORTAL_BE_HOST}:3000; }        # 配置中心
    upstream xspace_agent   { server ${XSPACE_AGENT_HOST}:8000; }     # AI 工作区
    
    server {
        listen 8100;
        server_name _;
        
        # === 静态资源 (SPA) ===
        location / {
            root /app/static;
            try_files $uri $uri/ /index.html;
            expires 1h;
        }
        
        # === 认证 ===
        location /api/v1/auth/ {
            proxy_pass http://platform_be/api/v1/auth/;
            proxy_set_header Host $host;
            proxy_set_header X-Real-IP $remote_addr;
        }
        
        # === 管理控制面 ===
        location /api/v1/admin/ {
            proxy_pass http://hmr_admin_be/api/v1/admin/;
            proxy_set_header Host $host;
            proxy_set_header X-Real-IP $remote_addr;
        }
        
        # === 运管平台 ===
        location /api/v1/ops/ {
            proxy_pass http://hmr_ops_be/api/v1/ops/;
            proxy_set_header Host $host;
            proxy_set_header X-Real-IP $remote_addr;
        }
        
        # === AI Gateway ===
        location /api/v1/gateway/ {
            proxy_pass http://hmr_ai_gateway/api/v1/gateway/;
            proxy_set_header Host $host;
            proxy_set_header X-Real-IP $remote_addr;
            proxy_read_timeout 300s;  # AI 调用可能较慢
        }
        
        # === WebSocket ===
        location /ws/ {
            proxy_pass http://hmr_ai_gateway/ws/;
            proxy_http_version 1.1;
            proxy_set_header Upgrade $http_upgrade;
            proxy_set_header Connection "upgrade";
            proxy_set_header Host $host;
            proxy_read_timeout 86400s;
        }
        
        # === 技能市场（clawhub）代理 ===
        location /clawhub/ {
            proxy_pass http://clawhub/;
            proxy_set_header Host $host;
        }

        # === 配置中心（portal）代理 ===
        location /portal/ {
            proxy_pass http://portal_be/;
            proxy_set_header Host $host;
        }

        # === AI 工作区（xspace）代理 ===
        location /xspace/ {
            proxy_pass http://xspace_agent/xspace/;
            proxy_set_header Host $host;
            proxy_read_timeout 300s;
            # SSE 支持
            proxy_buffering off;
            proxy_cache off;
        }
        
        # === 健康检查 ===
        location /health {
            return 200 'ok';
            add_header Content-Type text/plain;
        }
    }
}
```

## 5.2 Helm Charts

### Chart 结构（每个服务）
```
charts/hmr-admin-be/
├── Chart.yaml
├── values.yaml
├── templates/
│   ├── _helpers.tpl
│   ├── deployment.yaml
│   ├── service.yaml
│   ├── configmap.yaml
│   ├── hpa.yaml               # 水平自动扩展
│   └── serviceaccount.yaml
```

### values.yaml 示例 (hmr-admin-be)
```yaml
# 注：镜像仓库地址为示例占位，企业替换为自有镜像仓库
replicaCount: 2

image:
  repository: registry.example.com/hmr_dev/hmr-admin-be   # 示例：企业镜像仓库
  tag: latest
  pullPolicy: IfNotPresent

imagePullSecrets:
  - name: registry-pull-secret      # 企业镜像仓库拉取凭证

service:
  type: ClusterIP
  port: 8000

env:
  DATABASE_URL: ""
  PLATFORM_BE_URL: "http://platform-be.svc.cluster.local:8000"      # 平台后端（K8s 内部域名）
  CLAWHUB_URL: "http://clawhub.svc.cluster.local:3000"              # 技能市场（K8s 内部域名）
  PORTAL_BE_URL: "http://portal-backend.svc.cluster.local:3000"     # 配置中心（K8s 内部域名）
  AUTH_MODE: "oauth"

resources:
  requests:
    cpu: 200m
    memory: 256Mi
  limits:
    cpu: 500m
    memory: 512Mi

autoscaling:
  enabled: true
  minReplicas: 2
  maxReplicas: 5
  targetCPUUtilizationPercentage: 70
```

### hmr-inrouter Chart
```yaml
# charts/hmr-inrouter/values.yaml
# 注：镜像仓库地址为示例占位，企业替换为自有镜像仓库
replicaCount: 2

image:
  repository: registry.example.com/hmr_dev/hmr-inrouter   # 示例：企业镜像仓库
  tag: latest

service:
  type: ClusterIP
  port: 8100

upstreams:
  platformBe: "platform-be.svc.cluster.local:8000"               # 平台后端
  hmrAdminBe: "hmr-admin-be.hmr:8000"
  hmrOpsBe: "hmr-ops-be.hmr:8000"
  hmrAiGateway: "hmr-ai-gateway.hmr:8000"
  clawhub: "clawhub.svc.cluster.local:3000"                      # 技能市场
  portalBe: "portal-backend.svc.cluster.local:3000"              # 配置中心
  xspaceAgent: "xspace-agent.svc.cluster.local:8000"             # AI 工作区
```

## 5.3 Dockerfile

### Python 服务通用 Dockerfile
```dockerfile
# service/hmr-admin-be/Dockerfile
FROM python:3.12-slim AS base

WORKDIR /app

# 安装 uv
COPY --from=ghcr.io/astral-sh/uv:latest /uv /usr/local/bin/uv

# 安装依赖
COPY pyproject.toml uv.lock ./
COPY packages/db/ /packages/db/
COPY packages/shared/ /packages/shared/
RUN uv sync --frozen --no-dev

# 复制代码
COPY service/hmr-admin-be/ .

# Prisma generate
RUN uv run prisma generate --schema=/packages/db/prisma/schema.prisma

EXPOSE 8000
CMD ["uv", "run", "uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
```

### inrouter Dockerfile
```dockerfile
FROM nginx:1.25-alpine

COPY service/hmr-inrouter/nginx.conf /etc/nginx/nginx.conf
COPY apps/web/dist/ /app/static/

EXPOSE 8100
CMD ["nginx", "-g", "daemon off;"]
```

## 5.4 部署拓扑

```yaml
# deploy/helmfile.yaml
repositories:
  - name: hmr
    url: "file://./charts"

releases:
  - name: hmr-inrouter
    namespace: hmr
    chart: hmr/hmr-inrouter
    values: [values/hmr-inrouter.yaml]
    
  - name: hmr-admin-be
    namespace: hmr
    chart: hmr/hmr-admin-be
    values: [values/hmr-admin-be.yaml]
    
  - name: hmr-ops-be
    namespace: hmr
    chart: hmr/hmr-ops-be
    values: [values/hmr-ops-be.yaml]
    
  - name: hmr-ai-gateway
    namespace: hmr
    chart: hmr/hmr-ai-gateway
    values: [values/hmr-ai-gateway.yaml]
```

## 5.5 Secret 管理

```
deploy/manifests/secrets/
├── _base/
│   └── kustomization.yaml          # Secret 字段 PLACEHOLDER
├── dev/
│   └── kustomization.yaml.example  # 开发环境 FILL_ME
└── prod/
    └── kustomization.yaml.example  # 生产环境 FILL_ME
```

### 必需 Secret
| Secret 名 | Key | 来源 |
|-----------|-----|------|
| hmr-db | DATABASE_URL | MySQL 连接串 |
| hmr-db-pg | PG_DATABASE_URL | PostgreSQL 连接串 |
| hmr-auth | JWT_SECRET, OAUTH_CLIENT_SECRET | 认证密钥 |
| hmr-ai | ANTHROPIC_API_KEY, LITELLM_API_KEY | AI 模型密钥 |

## 5.6 CI/CD Pipeline

```yaml
# .github/workflows/build-deploy.yaml (或企业 CI/CD 流水线，如 GitLab CI/Jenkins/ArgoCD)
stages:
  - lint-and-test
  - build-images
  - deploy-dev
  - deploy-prod

# 每个服务独立构建、独立部署
# 前端构建产物嵌入 inrouter 镜像
```

## 5.7 验证标准
- [ ] `helm template` 所有 Chart 渲染无报错
- [ ] 本地 Docker Compose 启动全栈成功
- [ ] K8s 集群部署后所有 Pod Running
- [ ] inrouter 路由到各后端正常
- [ ] WebSocket 通过 inrouter 建立成功
- [ ] 前端 SPA 加载正常
- [ ] 健康检查全部通过
