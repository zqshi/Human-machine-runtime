#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT_DIR"

MATRIX_HS="${MATRIX_HS:-http://127.0.0.1:8008}"
DCF_APP_PORT="${DCF_APP_PORT:-3010}"
DCF_BASE_URL="${DCF_BASE_URL:-http://127.0.0.1:${DCF_APP_PORT}}"
CONTROL_PLANE_ADMIN_TOKEN="${CONTROL_PLANE_ADMIN_TOKEN:-dev-admin-token}"
BOT_LOCALPART="${MATRIX_BOT_LOCALPART:-dcfbot}"
BOT_PASSWORD="${MATRIX_BOT_PASSWORD:-dcfbot123}"
USER_LOCALPART="${MATRIX_USER_LOCALPART:-opsuser}"
USER_PASSWORD="${MATRIX_USER_PASSWORD:-opsuser123}"
AGENT_NAME="${MATRIX_AGENT_NAME:-matrix-auto-agent-$(date +%H%M%S)}"
TOKEN_DIR="$ROOT_DIR/runtime"

json_field() {
  local key="$1"
  node -e "const fs=require('fs');const d=JSON.parse(fs.readFileSync(0,'utf8'));if(!(\"$key\" in d)){process.exit(2)};process.stdout.write(String(d[\"$key\"]));"
}

is_rate_limited() {
  local text="$1"
  echo "$text" | rg -q 'M_LIMIT_EXCEEDED|Too many requests'
}

retry_wait_seconds() {
  local text="$1"
  local sec
  sec="$(echo "$text" | node -e "const fs=require('fs');let d='';try{d=JSON.parse(fs.readFileSync(0,'utf8'));}catch{};const ms=Number((d&&d.retry_after_ms)||1000);process.stdout.write(String(Math.max(1,Math.ceil(ms/1000))))" 2>/dev/null || true)"
  if [ -z "${sec:-}" ]; then
    sec="1"
  fi
  echo "$sec"
}

with_retry() {
  local attempts="$1"
  shift
  local out=""
  for _ in $(seq 1 "$attempts"); do
    out="$("$@" || true)"
    if is_rate_limited "$out"; then
      sleep "$(retry_wait_seconds "$out")"
      continue
    fi
    echo "$out"
    return 0
  done
  echo "$out"
  return 0
}

urlenc() {
  local value="$1"
  node -e "process.stdout.write(encodeURIComponent(process.argv[1]||''))" "$value"
}

ensure_user() {
  local user="$1"
  local pass="$2"
  local full="@${user}:localhost"
  local token_file="${TOKEN_DIR}/matrix-${user}.token"
  local cached_token=""

  if [ -f "$token_file" ]; then
    cached_token="$(cat "$token_file" | tr -d '\r\n' || true)"
    if [ -n "$cached_token" ]; then
      if curl -sS "${MATRIX_HS}/_matrix/client/v3/account/whoami" \
        -H "Authorization: Bearer ${cached_token}" | rg -q "\"user_id\":\"${full}\""; then
        echo "$cached_token"
        return
      fi
    fi
  fi

  local login_body
  login_body="$(cat <<JSON
{"type":"m.login.password","user":"${user}","password":"${pass}"}
JSON
)"
  local login_res=""
  for _ in $(seq 1 5); do
    login_res="$(with_retry 3 curl -sS -X POST "${MATRIX_HS}/_matrix/client/v3/login" -H 'content-type: application/json' -d "${login_body}")"
    if echo "$login_res" | rg -q '"access_token"'; then
      break
    fi
    if is_rate_limited "$login_res"; then
      sleep "$(retry_wait_seconds "$login_res")"
      continue
    fi
    break
  done
  if echo "$login_res" | rg -q '"access_token"'; then
    echo "$login_res" | json_field access_token | tee "$token_file" >/dev/null
    cat "$token_file"
    return
  fi

  docker exec dcf-matrix-synapse register_new_matrix_user --exists-ok --no-admin -u "$user" -p "$pass" -c /data/homeserver.yaml "http://localhost:8008" >/dev/null
  for _ in $(seq 1 8); do
    login_res="$(with_retry 3 curl -sS -X POST "${MATRIX_HS}/_matrix/client/v3/login" -H 'content-type: application/json' -d "${login_body}")"
    if echo "$login_res" | rg -q '"access_token"'; then
      break
    fi
    sleep 1
  done
  if ! echo "$login_res" | rg -q '"access_token"'; then
    echo "[error] login failed for ${full}: ${login_res}"
    exit 1
  fi
  echo "$login_res" | json_field access_token | tee "$token_file" >/dev/null
  cat "$token_file"
}

echo "[e2e] ensure matrix users"
BOT_TOKEN="$(ensure_user "$BOT_LOCALPART" "$BOT_PASSWORD")"
USER_TOKEN="$(ensure_user "$USER_LOCALPART" "$USER_PASSWORD")"
BOT_USER_ID="@${BOT_LOCALPART}:localhost"

echo "[e2e] create room"
ROOM_RES="$(with_retry 8 curl -sS -X POST "${MATRIX_HS}/_matrix/client/v3/createRoom" \
  -H "Authorization: Bearer ${USER_TOKEN}" \
  -H 'content-type: application/json' \
  -d "{\"name\":\"dcf-e2e-room\",\"preset\":\"private_chat\"}")"
if ! echo "$ROOM_RES" | rg -q '"room_id"'; then
  echo "[error] create room failed: $ROOM_RES"
  exit 1
fi
ROOM_ID="$(echo "$ROOM_RES" | json_field room_id)"

echo "[e2e] invite and join bot"
with_retry 8 curl -sS -X POST "${MATRIX_HS}/_matrix/client/v3/rooms/$(urlenc "$ROOM_ID")/invite" \
  -H "Authorization: Bearer ${USER_TOKEN}" \
  -H 'content-type: application/json' \
  -d "{\"user_id\":\"${BOT_USER_ID}\"}" >/dev/null
with_retry 8 curl -sS -X POST "${MATRIX_HS}/_matrix/client/v3/join/$(urlenc "$ROOM_ID")" \
  -H "Authorization: Bearer ${BOT_TOKEN}" \
  -H 'content-type: application/json' \
  -d '{}' >/dev/null

echo "[e2e] wait bot membership sync"
BOT_READY=0
for _ in $(seq 1 30); do
  MEMBERS="$(curl -sS "${MATRIX_HS}/_matrix/client/v3/rooms/$(urlenc "$ROOM_ID")/members" -H "Authorization: Bearer ${BOT_TOKEN}" || true)"
  if echo "$MEMBERS" | rg -q "\"user_id\":\"${BOT_USER_ID}\""; then
    BOT_READY=1
    break
  fi
  sleep 1
done
if [ "$BOT_READY" -ne 1 ]; then
  echo "[warn] bot membership not confirmed, continue with retries"
fi

send_create_command() {
  local txn_id="$1"
  with_retry 8 curl -sS -X PUT "${MATRIX_HS}/_matrix/client/v3/rooms/$(urlenc "$ROOM_ID")/send/m.room.message/${txn_id}" \
    -H "Authorization: Bearer ${USER_TOKEN}" \
    -H 'content-type: application/json' \
    -d "{\"msgtype\":\"m.text\",\"body\":\"!create_agent ${AGENT_NAME}\"}" >/dev/null
}

echo "[e2e] send create command via matrix room"
TXN_ID="txn_$(date +%s)"
send_create_command "$TXN_ID"

echo "[e2e] query control plane until instance appears"

FOUND_ID=""
for i in $(seq 1 30); do
  if [ $(( i % 8 )) -eq 0 ]; then
    send_create_command "txn_$(date +%s)_${i}"
  fi
  RES="$(curl -sS "${DCF_BASE_URL}/api/control/instances?name=${AGENT_NAME}" -H "Authorization: Bearer ${CONTROL_PLANE_ADMIN_TOKEN}")"
  if is_rate_limited "$RES"; then
    sleep "$(retry_wait_seconds "$RES")"
    continue
  fi
  FOUND_ID="$(echo "$RES" | node -e "const fs=require('fs');const raw=fs.readFileSync(0,'utf8');try{const d=JSON.parse(raw);const row=(d.data||[])[0];process.stdout.write(row&&row.id?row.id:'');}catch{process.stdout.write('');}")"
  if [ -n "$FOUND_ID" ]; then
    break
  fi
  sleep 1
done

if [ -z "$FOUND_ID" ]; then
  echo "[error] instance not created from matrix message, name=${AGENT_NAME}"
  exit 1
fi

echo "[ok] matrix e2e success"
echo "room_id=${ROOM_ID}"
echo "agent_name=${AGENT_NAME}"
echo "instance_id=${FOUND_ID}"
