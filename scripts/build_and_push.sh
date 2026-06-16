#!/bin/bash
set -euo pipefail

# 构建并推送 hmr-server / hmr-client 镜像到企业自有镜像仓库。
#
# 企业自填项（通过环境变量或 CI Secret 注入，脚本不内置任何默认值）：
#   HARBOR_URL        镜像仓库地址，例如 ghcr.io/your-org 或企业自建 registry（hub.example.com）
#   HARBOR_NAMESPACE  镜像命名空间，例如 hmr
#   HARBOR_USERNAME   仓库账号
#   HARBOR_PASSWORD   仓库密码/Token
#
# 用法：
#   HARBOR_URL=ghcr.io/your-org HARBOR_NAMESPACE=hmr \
#     HARBOR_USERNAME=xxx HARBOR_PASSWORD=xxx ./scripts/build_and_push.sh v1.0.0

VERSION="${1:-latest}"

: "${HARBOR_URL:?HARBOR_URL is required (e.g. ghcr.io/your-org)}"
: "${HARBOR_NAMESPACE:?HARBOR_NAMESPACE is required}"
: "${HARBOR_USERNAME:?HARBOR_USERNAME is required}"
: "${HARBOR_PASSWORD:?HARBOR_PASSWORD is required}"

IMAGE_SERVER="${HARBOR_URL}/${HARBOR_NAMESPACE}/hmr-server:${VERSION}"
IMAGE_CLIENT="${HARBOR_URL}/${HARBOR_NAMESPACE}/hmr-client:${VERSION}"

echo "==> Logging into registry: ${HARBOR_URL}"
echo "${HARBOR_PASSWORD}" | docker login "${HARBOR_URL}" -u "${HARBOR_USERNAME}" --password-stdin

REPO_ROOT="$(cd "$(dirname "$0")/.." && pwd)"

echo "==> Building server image: ${IMAGE_SERVER}"
docker build -t "${IMAGE_SERVER}" "${REPO_ROOT}/server"

echo "==> Pushing server image"
docker push "${IMAGE_SERVER}"

echo "==> Building client image: ${IMAGE_CLIENT}"
docker build -t "${IMAGE_CLIENT}" "${REPO_ROOT}/client-suite"

echo "==> Pushing client image"
docker push "${IMAGE_CLIENT}"

echo "==> Done. Images pushed:"
echo "    ${IMAGE_SERVER}"
echo "    ${IMAGE_CLIENT}"
