#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT_DIR"

APP_PORT="${DCF_APP_PORT:-3010}"
APP_HOST="${DCF_APP_HOST:-127.0.0.1}"
MATRIX_HS="${MATRIX_HS:-http://127.0.0.1:8008}"
BOT_LOCALPART="${MATRIX_BOT_LOCALPART:-dcfbot}"
BOT_PASSWORD="${MATRIX_BOT_PASSWORD:-dcfbot123}"
LOCAL_RATE_LIMIT_MAX_REQUESTS="${LOCAL_RATE_LIMIT_MAX_REQUESTS:-100000}"
LOCAL_RATE_LIMIT_WINDOW_MS="${LOCAL_RATE_LIMIT_WINDOW_MS:-60000}"
LOG_FILE="$ROOT_DIR/runtime/dcf-app.log"
PID_FILE="$ROOT_DIR/runtime/dcf-app.pid"
BOT_TOKEN_FILE="$ROOT_DIR/runtime/matrix-bot.token"
BOT_DEVICE_FILE="$ROOT_DIR/runtime/matrix-bot.device"

mkdir -p "$ROOT_DIR/runtime"

if [ -f .env ]; then
  set -a
  source <(grep -E '^[A-Za-z_][A-Za-z0-9_]*=.*$' .env)
  set +a
fi

json_field() {
  local key="$1"
  node -e "const fs=require('fs');const d=JSON.parse(fs.readFileSync(0,'utf8'));if(!('$key' in d)){process.exit(2)};process.stdout.write(String(d['$key']));"
}

ensure_bot_token() {
  local login_body
  login_body="{\"type\":\"m.login.password\",\"user\":\"${BOT_LOCALPART}\",\"password\":\"${BOT_PASSWORD}\"}"
  local cached_token=""

  if [ -f "$BOT_TOKEN_FILE" ]; then
    cached_token="$(cat "$BOT_TOKEN_FILE" | tr -d '\r\n' || true)"
    if [ -n "${cached_token}" ]; then
      if curl -sS "${MATRIX_HS}/_matrix/client/v3/account/whoami" \
        -H "Authorization: Bearer ${cached_token}" | rg -q "\"user_id\":\"@${BOT_LOCALPART}:localhost\""; then
        echo "$cached_token"
        return
      fi
    fi
  fi

  local out=""
  local wait_ms=""
  for _ in $(seq 1 10); do
    out="$(curl -sS -X POST "${MATRIX_HS}/_matrix/client/v3/login" -H 'content-type: application/json' -d "${login_body}" || true)"
    if echo "$out" | rg -q '"access_token"'; then
      echo "$out" | json_field access_token | tee "$BOT_TOKEN_FILE" >/dev/null
      cat "$BOT_TOKEN_FILE"
      return
    fi
    if echo "$out" | rg -q 'M_LIMIT_EXCEEDED'; then
      wait_ms="$(echo "$out" | node -e "const fs=require('fs');try{const d=JSON.parse(fs.readFileSync(0,'utf8'));process.stdout.write(String(d.retry_after_ms||1000));}catch{process.stdout.write('1000')}")"
      sleep "$(node -e "const ms=Number(process.argv[1]||1000);process.stdout.write(String(Math.max(1,Math.ceil(ms/1000))))" "$wait_ms")"
      continue
    fi
    break
  done

  docker exec dcf-matrix-synapse register_new_matrix_user --exists-ok --no-admin \
    -u "$BOT_LOCALPART" -p "$BOT_PASSWORD" -c /data/homeserver.yaml http://localhost:8008 >/dev/null

  for _ in $(seq 1 10); do
    out="$(curl -sS -X POST "${MATRIX_HS}/_matrix/client/v3/login" -H 'content-type: application/json' -d "${login_body}" || true)"
    if echo "$out" | rg -q '"access_token"'; then
      echo "$out" | json_field access_token | tee "$BOT_TOKEN_FILE" >/dev/null
      cat "$BOT_TOKEN_FILE"
      return
    fi
    if echo "$out" | rg -q 'M_LIMIT_EXCEEDED'; then
      wait_ms="$(echo "$out" | node -e "const fs=require('fs');try{const d=JSON.parse(fs.readFileSync(0,'utf8'));process.stdout.write(String(d.retry_after_ms||1000));}catch{process.stdout.write('1000')}")"
      sleep "$(node -e "const ms=Number(process.argv[1]||1000);process.stdout.write(String(Math.max(1,Math.ceil(ms/1000))))" "$wait_ms")"
      continue
    fi
    sleep 1
  done

  if ! echo "$out" | rg -q '"access_token"'; then
    echo "[error] failed to login matrix bot: $out"
    exit 1
  fi
}

resolve_bot_device_id() {
  local token="$1"
  local out=""
  out="$(curl -sS "${MATRIX_HS}/_matrix/client/v3/account/whoami" -H "Authorization: Bearer ${token}" || true)"
  if echo "$out" | rg -q '"device_id"'; then
    echo "$out" | json_field device_id | tee "$BOT_DEVICE_FILE" >/dev/null
    cat "$BOT_DEVICE_FILE"
    return
  fi
  if [ -f "$BOT_DEVICE_FILE" ]; then
    cat "$BOT_DEVICE_FILE" | tr -d '\r\n'
    return
  fi
  echo ""
}

if [ -f "$PID_FILE" ]; then
  OLD_PID="$(cat "$PID_FILE" || true)"
  if [ -n "${OLD_PID:-}" ] && kill -0 "$OLD_PID" >/dev/null 2>&1; then
    echo "[start] dcf app already running pid=$OLD_PID"
    exit 0
  fi
fi

EXISTING_PID="$(lsof -ti:${APP_PORT} 2>/dev/null | head -n 1 || true)"
if [ -n "${EXISTING_PID:-}" ] && kill -0 "$EXISTING_PID" >/dev/null 2>&1; then
  echo "$EXISTING_PID" > "$PID_FILE"
  echo "[start] dcf app already listening on ${APP_HOST}:${APP_PORT} pid=$EXISTING_PID"
  exit 0
fi

BOT_TOKEN="$(ensure_bot_token)"
MATRIX_USER_ID="@${BOT_LOCALPART}:localhost"
MATRIX_DEVICE_ID="$(resolve_bot_device_id "$BOT_TOKEN")"

nohup env \
  PORT="$APP_PORT" \
  HOST="$APP_HOST" \
  MATRIX_HOMESERVER="$MATRIX_HS" \
  MATRIX_USER_ID="$MATRIX_USER_ID" \
  MATRIX_DEVICE_ID="$MATRIX_DEVICE_ID" \
  MATRIX_ACCESS_TOKEN="$BOT_TOKEN" \
  MATRIX_E2EE_ENABLED="${MATRIX_E2EE_ENABLED:-false}" \
  MATRIX_RELAY_ENABLED=true \
  KUBERNETES_SIMULATION_MODE="${KUBERNETES_SIMULATION_MODE:-true}" \
  PLATFORM_BASE_URL="http://${APP_HOST}:${APP_PORT}" \
  OPENCLAW_IMAGE="${OPENCLAW_IMAGE:-openclaw:local}" \
  OPENCLAW_RUNTIME_VERSION="${OPENCLAW_RUNTIME_VERSION:-2026.2.13}" \
  OPENCLAW_SOURCE_PATH="${OPENCLAW_SOURCE_PATH:-/Users/zqs/Downloads/project/dependencies/openclaw}" \
  RATE_LIMIT_MAX_REQUESTS="$LOCAL_RATE_LIMIT_MAX_REQUESTS" \
  RATE_LIMIT_WINDOW_MS="$LOCAL_RATE_LIMIT_WINDOW_MS" \
  MINIMAX_API_KEY="${MINIMAX_API_KEY:-}" \
  DEEPSEEK_API_KEY="${DEEPSEEK_API_KEY:-}" \
  npm start >"$LOG_FILE" 2>&1 &

APP_PID=$!
echo "$APP_PID" > "$PID_FILE"

for _ in $(seq 1 30); do
  if curl -fsS "http://${APP_HOST}:${APP_PORT}/status" >/dev/null 2>&1; then
    break
  fi
  sleep 1
done

curl -fsS "http://${APP_HOST}:${APP_PORT}/status" | head -c 240; echo

echo "[ok] dcf app started pid=$APP_PID url=http://${APP_HOST}:${APP_PORT}"
