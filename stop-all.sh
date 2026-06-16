#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "$0")" && pwd)"
cd "$ROOT_DIR"

bash scripts/stop-dcf-app.sh || true
bash scripts/stop-openclaw-stack.sh || true

echo "[ok] all stopped"
