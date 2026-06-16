#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
CHART_DIR="${ROOT_DIR}/deploy/helm/dcf-light-bot"
LINT_SCRIPT="${ROOT_DIR}/scripts/lint-yaml-manifests.js"

if ! command -v helm >/dev/null 2>&1; then
  echo "[fail] helm not found; install helm to run chart check"
  exit 1
fi

helm lint "${CHART_DIR}"

RENDERED_DEFAULT="$(mktemp)"
RENDERED_DEV="$(mktemp)"
RENDERED_PROD="$(mktemp)"
trap 'rm -f "${RENDERED_DEFAULT}" "${RENDERED_DEV}" "${RENDERED_PROD}"' EXIT

helm template dcf-light-bot "${CHART_DIR}" > "${RENDERED_DEFAULT}"
node "${LINT_SCRIPT}" "${RENDERED_DEFAULT}"

helm template dcf-light-bot "${CHART_DIR}" -f "${CHART_DIR}/values-dev.yaml" > "${RENDERED_DEV}"
node "${LINT_SCRIPT}" "${RENDERED_DEV}"

helm template dcf-light-bot "${CHART_DIR}" -f "${CHART_DIR}/values-prod.yaml" > "${RENDERED_PROD}"
node "${LINT_SCRIPT}" "${RENDERED_PROD}"

echo "[ok] helm chart lint and render checks passed"
