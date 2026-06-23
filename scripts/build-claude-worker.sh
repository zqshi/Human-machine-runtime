#!/usr/bin/env bash
# 构建 claude-worker:latest Docker 镜像
#
# 用法: bash scripts/build-claude-worker.sh
#
# 镜像用于 ClaudeAgentSdkAdapter 在 Docker 沙箱内执行真实 Agent 任务。
# 集成测试(server/src/contexts/agent-core/adapters/claude-agent-sdk-adapter.integration.test.ts)
# 依赖本镜像存在。

set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
IMAGE_NAME="claude-worker"
IMAGE_TAG="latest"

DOCKER_CONTEXT="${REPO_ROOT}/infra/claude-worker"

if ! command -v docker >/dev/null 2>&1; then
  echo "ERROR: docker not found in PATH" >&2
  exit 1
fi

echo ">> Building ${IMAGE_NAME}:${IMAGE_TAG} from ${DOCKER_CONTEXT}"
docker build -t "${IMAGE_NAME}:${IMAGE_TAG}" "${DOCKER_CONTEXT}"

echo ">> Done. Verifying..."
docker image inspect "${IMAGE_NAME}:${IMAGE_TAG}" --format 'Image: {{.RepoTags}}  Size: {{.Size}} bytes  Created: {{.Created}}'
