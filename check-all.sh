#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "$0")" && pwd)"
cd "$ROOT_DIR"

bash scripts/start-openclaw-stack.sh
bash scripts/start-hmr-app.sh
bash scripts/check-openclaw-stack.sh
bash scripts/check-hmr-app.sh

echo "[ok] all checks passed"
