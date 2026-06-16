#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT_DIR"

echo "[smoke] matrix endpoint"
curl -fsS http://127.0.0.1:8008/_matrix/client/versions >/dev/null

echo "[smoke] openclaw ui endpoint"
curl -fsS http://127.0.0.1:18789/ >/dev/null

echo "[smoke] matrix element endpoint"
curl -fsS http://127.0.0.1:8081/ >/dev/null

echo "[smoke] dcf health"
curl -fsS http://127.0.0.1:3010/status >/dev/null || echo "[warn] dcf-light-bot app not running on :3010"

echo "[ok] smoke passed"
