#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
KUSTOMIZE_DIR="${ROOT_DIR}/deploy/k8s/base"
RENDERED_FILE="$(mktemp)"
trap 'rm -f "${RENDERED_FILE}"' EXIT

if ! command -v kubectl >/dev/null 2>&1; then
  echo "[fail] kubectl not found; install kubectl to run manifest check"
  exit 1
fi

kubectl kustomize "${KUSTOMIZE_DIR}" > "${RENDERED_FILE}"
node "${ROOT_DIR}/scripts/lint-yaml-manifests.js" "${RENDERED_FILE}"

echo "[ok] k8s manifests rendered and validated"
