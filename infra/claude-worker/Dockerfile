# claude-worker: Claude Agent SDK 任务执行容器
#
# 每次任务由宿主 HMR server 通过 `docker run --rm` 起一个新容器实例。
# 任务参数通过 CLAUDE_TASK_JSON env 传入,任务通过 stdout NDJSON 流上报进度。
#
# 安全约束:
#   - 默认 bridge 网络(--network bridge):能访问 Anthropic API 但无法访问宿主内网
#   - --cap-drop ALL + --security-opt no-new-privileges:禁止特权升级
#   - /workspace 为唯一可写挂载,容器退出后清理(--rm)

# ──── 构建阶段 ────
FROM node:20-alpine AS build
WORKDIR /app

# 构建阶段装全部依赖(含 typescript),不 omit dev
COPY package.json package-lock.json* ./
RUN npm ci || npm install

COPY tsconfig.json ./
COPY worker.ts ./
RUN npx tsc

# 重新只装 production 依赖(供运行时阶段使用)
RUN npm ci --omit=dev || npm install --omit=dev

# ──── 运行时阶段 ────
FROM node:20-alpine
WORKDIR /app

# git:Read/Glob/Grep 在某些场景需要;wget:健康检查
# jq:调试方便(可选,但容器小成本可忽略)
RUN apk add --no-cache git wget jq

# 仅复制运行时必需文件(不复制 tsconfig.json/worker.ts 源码)
COPY --from=build /app/package.json ./
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/dist/worker.js ./

# workspace 是任务工作目录,由宿主 -v 挂载
WORKDIR /workspace
VOLUME ["/workspace"]

# 简易健康检查(容器自身进程存活)
HEALTHCHECK --interval=60s --timeout=3s --start-period=2s --retries=2 \
  CMD test -d /proc/1 || exit 1

ENTRYPOINT ["node", "/app/worker.js"]
