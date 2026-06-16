#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT_DIR"

MATRIX_HS="${MATRIX_HS:-http://127.0.0.1:8008}"
BOT_LOCALPART="${MATRIX_BOT_LOCALPART:-dcfbot}"
BOT_PASSWORD="${MATRIX_BOT_PASSWORD:-dcfbot123}"
BOT_DISPLAY_NAME="${MATRIX_BOT_DISPLAY_NAME:-数字工厂bot}"
FACTORY_ROOM_ALIAS_LOCALPART="${FACTORY_ROOM_ALIAS_LOCALPART:-dcf-factory}"
FACTORY_ROOM_NAME="${FACTORY_ROOM_NAME:-数字工厂服务台}"
FACTORY_ROOM_TOPIC="${FACTORY_ROOM_TOPIC:-数字员工创建与协作入口（非加密房间）}"
MATRIX_E2EE_ENABLED="${MATRIX_E2EE_ENABLED:-false}"

wait_matrix() {
  for _ in $(seq 1 80); do
    if curl -fsS "${MATRIX_HS}/_matrix/client/versions" >/dev/null 2>&1; then
      return 0
    fi
    sleep 1
  done
  return 1
}

json_field() {
  local key="$1"
  node -e "const fs=require('fs');const d=JSON.parse(fs.readFileSync(0,'utf8'));process.stdout.write(String(d['$key']||''));"
}

urlenc() {
  local value="$1"
  node -e "process.stdout.write(encodeURIComponent(process.argv[1]||''))" "$value"
}

is_true() {
  local v
  v="$(echo "${1:-}" | tr '[:upper:]' '[:lower:]')"
  [ "$v" = "1" ] || [ "$v" = "true" ] || [ "$v" = "yes" ] || [ "$v" = "on" ]
}

if ! wait_matrix; then
  echo "[warn] matrix homeserver unavailable: ${MATRIX_HS}"
  exit 0
fi

if ! docker ps --format '{{.Names}}' | grep -q '^dcf-matrix-synapse$'; then
  echo "[warn] synapse container not found, skip bot bootstrap"
  exit 0
fi

docker exec dcf-matrix-synapse register_new_matrix_user \
  --exists-ok --no-admin \
  -u "$BOT_LOCALPART" -p "$BOT_PASSWORD" \
  -c /data/homeserver.yaml "http://localhost:8008" >/dev/null

LOGIN_PAYLOAD="$(cat <<JSON
{"type":"m.login.password","identifier":{"type":"m.id.user","user":"${BOT_LOCALPART}"},"password":"${BOT_PASSWORD}"}
JSON
)"

LOGIN_RES="$(curl -sS -X POST "${MATRIX_HS}/_matrix/client/v3/login" \
  -H 'content-type: application/json' \
  -d "${LOGIN_PAYLOAD}")"

BOT_TOKEN="$(echo "$LOGIN_RES" | node -e "const fs=require('fs');const d=JSON.parse(fs.readFileSync(0,'utf8'));process.stdout.write(String(d.access_token||''));" 2>/dev/null || true)"
BOT_USER_ID="$(echo "$LOGIN_RES" | node -e "const fs=require('fs');const d=JSON.parse(fs.readFileSync(0,'utf8'));process.stdout.write(String(d.user_id||''));" 2>/dev/null || true)"

if [ -z "$BOT_TOKEN" ] || [ -z "$BOT_USER_ID" ]; then
  echo "[warn] bot login failed, cannot set display name: $LOGIN_RES"
  exit 0
fi

ENC_USER_ID="$(node -e "process.stdout.write(encodeURIComponent(process.argv[1]||''))" "$BOT_USER_ID")"
curl -sS -X PUT "${MATRIX_HS}/_matrix/client/v3/profile/${ENC_USER_ID}/displayname" \
  -H "Authorization: Bearer ${BOT_TOKEN}" \
  -H 'content-type: application/json' \
  -d "{\"displayname\":\"${BOT_DISPLAY_NAME}\"}" >/dev/null || true

FACTORY_CREATE_PAYLOAD="$(cat <<JSON
{
  "name":"${FACTORY_ROOM_NAME}",
  "topic":"${FACTORY_ROOM_TOPIC}",
  "preset":"public_chat",
  "visibility":"public",
  "room_alias_name":"${FACTORY_ROOM_ALIAS_LOCALPART}"
}
JSON
)"
FACTORY_ROOM_ID="$(curl -sS -X POST "${MATRIX_HS}/_matrix/client/v3/createRoom" \
  -H "Authorization: Bearer ${BOT_TOKEN}" \
  -H 'content-type: application/json' \
  -d "${FACTORY_CREATE_PAYLOAD}" | json_field room_id 2>/dev/null || true)"

if [ -z "${FACTORY_ROOM_ID:-}" ]; then
  FACTORY_ALIAS="#${FACTORY_ROOM_ALIAS_LOCALPART}:localhost"
  FACTORY_ROOM_ID="$(curl -sS "${MATRIX_HS}/_matrix/client/v3/directory/room/$(urlenc "$FACTORY_ALIAS")" \
    -H "Authorization: Bearer ${BOT_TOKEN}" | json_field room_id 2>/dev/null || true)"
fi

if [ -n "${FACTORY_ROOM_ID:-}" ]; then
  if ! is_true "$MATRIX_E2EE_ENABLED"; then
    ENCRYPTION_ALGO="$(curl -sS "${MATRIX_HS}/_matrix/client/v3/rooms/$(urlenc "$FACTORY_ROOM_ID")/state/m.room.encryption" \
      -H "Authorization: Bearer ${BOT_TOKEN}" | node -e "const fs=require('fs');try{const d=JSON.parse(fs.readFileSync(0,'utf8'));process.stdout.write(String(d.algorithm||''));}catch{process.stdout.write('')}" 2>/dev/null || true)"
    if [ -n "$ENCRYPTION_ALGO" ]; then
      FACTORY_ALIAS="#${FACTORY_ROOM_ALIAS_LOCALPART}:localhost"
      echo "[warn] factory room is encrypted while MATRIX_E2EE_ENABLED=false, rotating alias: ${FACTORY_ALIAS} (${FACTORY_ROOM_ID})"
      curl -sS -X DELETE "${MATRIX_HS}/_matrix/client/v3/directory/room/$(urlenc "$FACTORY_ALIAS")" \
        -H "Authorization: Bearer ${BOT_TOKEN}" >/dev/null || true

      ROTATE_CREATE_PAYLOAD="$(cat <<JSON
{
  "name":"${FACTORY_ROOM_NAME}",
  "topic":"${FACTORY_ROOM_TOPIC}",
  "preset":"public_chat",
  "visibility":"public",
  "initial_state":[
    {"type":"m.room.history_visibility","state_key":"","content":{"history_visibility":"shared"}},
    {"type":"m.room.guest_access","state_key":"","content":{"guest_access":"forbidden"}}
  ]
}
JSON
)"
      NEW_FACTORY_ROOM_ID="$(curl -sS -X POST "${MATRIX_HS}/_matrix/client/v3/createRoom" \
        -H "Authorization: Bearer ${BOT_TOKEN}" \
        -H 'content-type: application/json' \
        -d "${ROTATE_CREATE_PAYLOAD}" | json_field room_id 2>/dev/null || true)"
      if [ -n "$NEW_FACTORY_ROOM_ID" ]; then
        curl -sS -X PUT "${MATRIX_HS}/_matrix/client/v3/directory/room/$(urlenc "$FACTORY_ALIAS")" \
          -H "Authorization: Bearer ${BOT_TOKEN}" \
          -H 'content-type: application/json' \
          -d "{\"room_id\":\"${NEW_FACTORY_ROOM_ID}\"}" >/dev/null || true
        FACTORY_ROOM_ID="$NEW_FACTORY_ROOM_ID"
        echo "[ok] rotated to non-encrypted factory room: ${FACTORY_ALIAS} (${FACTORY_ROOM_ID})"
      else
        echo "[warn] failed to rotate factory room alias, keep existing room: ${FACTORY_ROOM_ID}"
      fi
    fi
  fi

  curl -sS -X POST "${MATRIX_HS}/_matrix/client/v3/rooms/$(urlenc "$FACTORY_ROOM_ID")/join" \
    -H "Authorization: Bearer ${BOT_TOKEN}" \
    -H 'content-type: application/json' \
    -d '{}' >/dev/null || true
  echo "[ok] matrix factory room ready: #${FACTORY_ROOM_ALIAS_LOCALPART}:localhost (${FACTORY_ROOM_ID})"
fi

echo "[ok] matrix bot ready: ${BOT_DISPLAY_NAME} (${BOT_USER_ID})"
