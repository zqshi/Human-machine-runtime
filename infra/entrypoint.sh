#!/bin/sh
set -e

echo "[dcf] starting Node.js API server..."
node /app/dist/app/index.js &
NODE_PID=$!

echo "[dcf] waiting for API readiness on :3002..."
TRIES=0
until wget -q --spider http://127.0.0.1:3002/health 2>/dev/null; do
  TRIES=$((TRIES + 1))
  if [ "$TRIES" -ge 60 ]; then
    echo "[dcf] ERROR: API failed to start within 30s"
    kill "$NODE_PID" 2>/dev/null || true
    exit 1
  fi
  sleep 0.5
done
echo "[dcf] API ready, starting Nginx on :8100..."

nginx -g "daemon off;" &
NGINX_PID=$!

cleanup() {
  echo "[dcf] shutting down..."
  kill "$NGINX_PID" 2>/dev/null || true
  kill "$NODE_PID" 2>/dev/null || true
  wait "$NGINX_PID" 2>/dev/null || true
  wait "$NODE_PID" 2>/dev/null || true
  echo "[dcf] stopped."
}

trap cleanup SIGTERM SIGINT
wait -n "$NODE_PID" "$NGINX_PID"
EXIT_CODE=$?
cleanup
exit $EXIT_CODE
