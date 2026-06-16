#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "$0")" && pwd)"
cd "$ROOT_DIR"

bash scripts/start-openclaw-stack.sh
bash scripts/start-dcf-app.sh

echo "[ok] all started"
