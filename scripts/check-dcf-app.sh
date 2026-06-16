#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT_DIR"

APP_PORT="${DCF_APP_PORT:-3010}"
APP_HOST="${DCF_APP_HOST:-127.0.0.1}"
PID_FILE="$ROOT_DIR/runtime/dcf-app.pid"
LOG_FILE="$ROOT_DIR/runtime/dcf-app.log"

PID=""
if [ -f "$PID_FILE" ]; then
  PID="$(cat "$PID_FILE")"
fi

if [ -z "${PID:-}" ] || ! kill -0 "$PID" >/dev/null 2>&1; then
  FALLBACK_PID="$(lsof -ti:${APP_PORT} 2>/dev/null | head -n 1 || true)"
  if [ -z "${FALLBACK_PID:-}" ]; then
    echo "[error] dcf app not running on ${APP_HOST}:${APP_PORT}"
    [ -f "$LOG_FILE" ] && tail -n 80 "$LOG_FILE"
    exit 1
  fi
  PID="$FALLBACK_PID"
  echo "$PID" > "$PID_FILE"
  echo "[warn] pid file missing/stale, recovered pid=$PID from port ${APP_PORT}"
fi

echo "[ok] process running pid=$PID"
echo "[status]"
curl -fsS "http://${APP_HOST}:${APP_PORT}/status" | head -c 600; echo

echo "[logs tail]"
[ -f "$LOG_FILE" ] && tail -n 40 "$LOG_FILE" || true
