# DCF All-in-One: Nginx (前端静态) + Node.js (API)
# 与 ks-claw inrouter 保持一致的容器架构

# ── Stage 1: 前端构建 ──
FROM node:20-alpine AS web-build
WORKDIR /web
COPY client-suite/package.json client-suite/package-lock.json ./
COPY client-suite/apps/web/package.json apps/web/package.json
COPY client-suite/packages/ui-tokens/package.json packages/ui-tokens/package.json
RUN npm ci --registry=https://registry.npmjs.org
COPY client-suite/apps/web/ apps/web/
COPY client-suite/packages/ui-tokens/ packages/ui-tokens/
RUN npm run -w @dcf/web build

# ── Stage 2: 后端构建 ──
FROM node:20-alpine AS server-build
WORKDIR /app
COPY server/package.json server/package-lock.json ./
RUN npm ci --registry=https://registry.npmjs.org
COPY server/tsconfig.json ./
COPY server/src/ src/
RUN npx tsc -b

# ── Stage 3: 运行时 (Nginx + Node.js) ──
FROM node:20-alpine
RUN apk add --no-cache nginx

WORKDIR /app

# 后端运行时依赖
COPY --from=server-build /app/package.json /app/package-lock.json ./
RUN npm ci --omit=dev --registry=https://registry.npmjs.org
COPY --from=server-build /app/dist/ dist/

# 前端静态资源
COPY --from=web-build /web/apps/web/dist/ /usr/share/nginx/html/

# Nginx + 启动脚本
COPY infra/nginx.conf /etc/nginx/nginx.conf
COPY infra/entrypoint.sh /entrypoint.sh
RUN chmod +x /entrypoint.sh

# Nginx 日志 → stdout/stderr
RUN ln -sf /dev/stdout /var/log/nginx/access.log && \
    ln -sf /dev/stderr /var/log/nginx/error.log

EXPOSE 8100

HEALTHCHECK --interval=30s --timeout=3s --start-period=15s --retries=3 \
  CMD wget -q --spider http://127.0.0.1:8100/health || exit 1

ENTRYPOINT ["/entrypoint.sh"]
