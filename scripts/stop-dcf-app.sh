#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT_DIR"

PID_FILE="$ROOT_DIR/runtime/dcf-app.pid"
APP_PORT="${DCF_APP_PORT:-3010}"

if [ ! -f "$PID_FILE" ]; then
  echo "[stop] pid file not found, continue to cleanup port ${APP_PORT}"
else
  PID="$(cat "$PID_FILE")"
  if [ -n "${PID:-}" ] && kill -0 "$PID" >/dev/null 2>&1; then
    kill "$PID" || true
    for _ in $(seq 1 10); do
      if ! kill -0 "$PID" >/dev/null 2>&1; then
        break
      fi
      sleep 1
    done
  fi
fi

for EXTRA_PID in $(lsof -ti:"${APP_PORT}" 2>/dev/null || true); do
  if [ -n "${EXTRA_PID}" ] && kill -0 "$EXTRA_PID" >/dev/null 2>&1; then
    kill "$EXTRA_PID" || true
  fi
done

for _ in $(seq 1 10); do
  if ! lsof -ti:"${APP_PORT}" >/dev/null 2>&1; then
    break
  fi
  sleep 1
done

rm -f "$PID_FILE"
echo "[ok] dcf app stopped"
