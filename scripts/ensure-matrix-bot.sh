#!/usr/bin/env bash
# 在 Conduit Matrix homeserver 上注册 HMR bot 账号,生成 token/device 文件,
# 配置 displayname,并创建/加入 factory room。
#
# 与 Synapse 版本的区别:
#   - 不依赖 synapse CLI register_new_matrix_user,改用 Conduit 的 /_matrix/client/v3/register API
#   - 不依赖 docker exec(允许 Conduit 容器名任意,或远程部署)
#   - Conduit allow_registration=true 时无需 shared secret,直接 m.login.dummy 通过
#
# 产出文件(供 start-hmr-app.sh / docker-compose env 使用):
#   runtime/matrix-bot.token   bot access_token
#   runtime/matrix-bot.device  bot device_id
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT_DIR"

# ──── 默认参数(对齐 server/src/config/index.ts:matrix.botUserId 默认值) ────
MATRIX_HS="${MATRIX_HS:-http://127.0.0.1:6167}"
BOT_LOCALPART="${MATRIX_BOT_LOCALPART:-hmr-bot}"
BOT_PASSWORD="${MATRIX_BOT_PASSWORD:-hmr-bot-changeme}"
BOT_DISPLAY_NAME="${MATRIX_BOT_DISPLAY_NAME:-数字工厂bot}"
FACTORY_ROOM_ALIAS_LOCALPART="${FACTORY_ROOM_ALIAS_LOCALPART:-hmr-factory}"
FACTORY_ROOM_NAME="${FACTORY_ROOM_NAME:-数字工厂服务台}"
FACTORY_ROOM_TOPIC="${FACTORY_ROOM_TOPIC:-数字员工创建与协作入口(非加密房间)}"
MATRIX_E2EE_ENABLED="${MATRIX_E2EE_ENABLED:-false}"
MAX_REGISTER_RETRY="${MAX_REGISTER_RETRY:-3}"

BOT_TOKEN_FILE="$ROOT_DIR/runtime/matrix-bot.token"
BOT_DEVICE_FILE="$ROOT_DIR/runtime/matrix-bot.device"
mkdir -p "$ROOT_DIR/runtime"

# ──── 辅助函数 ────

json_field() {
  local key="$1"
  node -e "const fs=require('fs');const d=JSON.parse(fs.readFileSync(0,'utf8'));if(!('$key' in d)){process.exit(2)};process.stdout.write(String(d['$key']));"
}

json_field_optional() {
  local key="$1"
  node -e "const fs=require('fs');try{const d=JSON.parse(fs.readFileSync(0,'utf8'));process.stdout.write(String(d['$key']||''));}catch{process.stdout.write('')}"
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

# 等待 Conduit 就绪(GET /_matrix/client/versions),最多 ~80 秒
wait_conduit() {
  for _ in $(seq 1 80); do
    if curl -fsS "${MATRIX_HS}/_matrix/client/versions" >/dev/null 2>&1; then
      return 0
    fi
    sleep 1
  done
  return 1
}

# 尝试 /register,失败时若用户已存在则 /login。返回 JSON(含 access_token/device_id/user_id)
acquire_bot_credentials() {
  local register_body
  register_body="$(cat <<JSON
{"username":"${BOT_LOCALPART}","password":"${BOT_PASSWORD}","auth":{"type":"m.login.dummy"}}
JSON
)"

  local login_body
  login_body="$(cat <<JSON
{"type":"m.login.password","identifier":{"type":"m.id.user","user":"${BOT_LOCALPART}"},"password":"${BOT_PASSWORD}"}
JSON
)"

  local out=""
  local errcode=""
  for attempt in $(seq 1 "$MAX_REGISTER_RETRY"); do
    out="$(curl -sS -X POST "${MATRIX_HS}/_matrix/client/v3/register" \
      -H 'content-type: application/json' \
      -d "${register_body}" 2>/dev/null || true)"

    if echo "$out" | node -e "const fs=require('fs');const d=JSON.parse(fs.readFileSync(0,'utf8'));process.exit(d.access_token?0:1)" 2>/dev/null; then
      echo "$out"
      return 0
    fi

    errcode="$(echo "$out" | json_field_optional errcode || true)"
    case "$errcode" in
      M_USER_IN_RATELIMIT)
        sleep 2
        continue
        ;;
      M_USER_IN_USE|M_INVALID_USERNAME|*)
        # 已存在 → fallback 到 /login
        break
        ;;
    esac
  done

  # 走 /login(已注册用户的常态路径)
  for _ in $(seq 1 5); do
    out="$(curl -sS -X POST "${MATRIX_HS}/_matrix/client/v3/login" \
      -H 'content-type: application/json' \
      -d "${login_body}" 2>/dev/null || true)"
    if echo "$out" | node -e "const fs=require('fs');const d=JSON.parse(fs.readFileSync(0,'utf8'));process.exit(d.access_token?0:1)" 2>/dev/null; then
      echo "$out"
      return 0
    fi
    if echo "$out" | node -e "const fs=require('fs');const d=JSON.parse(fs.readFileSync(0,'utf8'));process.exit(d.errcode==='M_LIMIT_EXCEEDED'?0:1)" 2>/dev/null; then
      sleep 1
      continue
    fi
    break
  done

  echo "[error] failed to register/login matrix bot via Conduit" >&2
  echo "        server: $MATRIX_HS" >&2
  echo "        user:   $BOT_LOCALPART" >&2
  echo "        response: $out" >&2
  echo "        hint: ensure Conduit is running and allow_registration=true" >&2
  return 1
}

# ──── 主流程 ────

if ! wait_conduit; then
  echo "[warn] conduit unavailable: ${MATRIX_HS}"
  exit 0
fi

CRED_JSON="$(acquire_bot_credentials)"
BOT_TOKEN="$(echo "$CRED_JSON" | json_field access_token)"
BOT_USER_ID="$(echo "$CRED_JSON" | json_field_optional user_id || echo "")"
BOT_DEVICE_ID="$(echo "$CRED_JSON" | json_field_optional device_id || echo "")"

# Conduit /login 响应有时无 user_id/device_id,从 whoami 补
if [ -z "$BOT_USER_ID" ] || [ -z "$BOT_DEVICE_ID" ]; then
  WHOAMI="$(curl -sS "${MATRIX_HS}/_matrix/client/v3/account/whoami" \
    -H "Authorization: Bearer ${BOT_TOKEN}" || true)"
  if [ -z "$BOT_USER_ID" ]; then
    BOT_USER_ID="$(echo "$WHOAMI" | json_field_optional user_id || echo "@${BOT_LOCALPART}:localhost")"
  fi
  if [ -z "$BOT_DEVICE_ID" ]; then
    BOT_DEVICE_ID="$(echo "$WHOAMI" | json_field_optional device_id || echo "")"
  fi
fi

# 持久化 token/device(供 start-hmr-app.sh / 部署脚本读取)
printf '%s' "$BOT_TOKEN" > "$BOT_TOKEN_FILE"
if [ -n "$BOT_DEVICE_ID" ]; then
  printf '%s' "$BOT_DEVICE_ID" > "$BOT_DEVICE_FILE"
fi
chmod 600 "$BOT_TOKEN_FILE" "$BOT_DEVICE_FILE" 2>/dev/null || true

echo "[ok] conduit bot registered/logged in: $BOT_USER_ID"

# ──── displayname ────
ENC_USER_ID="$(urlenc "$BOT_USER_ID")"
curl -sS -X PUT "${MATRIX_HS}/_matrix/client/v3/profile/${ENC_USER_ID}/displayname" \
  -H "Authorization: Bearer ${BOT_TOKEN}" \
  -H 'content-type: application/json' \
  -d "{\"displayname\":\"${BOT_DISPLAY_NAME}\"}" >/dev/null 2>&1 || true

# ──── factory room ────
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
  -d "${FACTORY_CREATE_PAYLOAD}" 2>/dev/null | json_field_optional room_id || true)"

if [ -z "${FACTORY_ROOM_ID:-}" ]; then
  FACTORY_ALIAS="#${FACTORY_ROOM_ALIAS_LOCALPART}:localhost"
  FACTORY_ROOM_ID="$(curl -sS "${MATRIX_HS}/_matrix/client/v3/directory/room/$(urlenc "$FACTORY_ALIAS")" \
    -H "Authorization: Bearer ${BOT_TOKEN}" 2>/dev/null | json_field_optional room_id || true)"
fi

if [ -n "${FACTORY_ROOM_ID:-}" ]; then
  if ! is_true "$MATRIX_E2EE_ENABLED"; then
    ENCRYPTION_ALGO="$(curl -sS "${MATRIX_HS}/_matrix/client/v3/rooms/$(urlenc "$FACTORY_ROOM_ID")/state/m.room.encryption" \
      -H "Authorization: Bearer ${BOT_TOKEN}" 2>/dev/null | json_field_optional algorithm || true)"
    if [ -n "$ENCRYPTION_ALGO" ]; then
      FACTORY_ALIAS="#${FACTORY_ROOM_ALIAS_LOCALPART}:localhost"
      echo "[warn] factory room is encrypted while MATRIX_E2EE_ENABLED=false, rotating alias: ${FACTORY_ALIAS} (${FACTORY_ROOM_ID})"
      curl -sS -X DELETE "${MATRIX_HS}/_matrix/client/v3/directory/room/$(urlenc "$FACTORY_ALIAS")" \
        -H "Authorization: Bearer ${BOT_TOKEN}" >/dev/null 2>&1 || true

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
        -d "${ROTATE_CREATE_PAYLOAD}" 2>/dev/null | json_field_optional room_id || true)"
      if [ -n "$NEW_FACTORY_ROOM_ID" ]; then
        curl -sS -X PUT "${MATRIX_HS}/_matrix/client/v3/directory/room/$(urlenc "$FACTORY_ALIAS")" \
          -H "Authorization: Bearer ${BOT_TOKEN}" \
          -H 'content-type: application/json' \
          -d "{\"room_id\":\"${NEW_FACTORY_ROOM_ID}\"}" >/dev/null 2>&1 || true
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
    -d '{}' >/dev/null 2>&1 || true
  echo "[ok] matrix factory room ready: #${FACTORY_ROOM_ALIAS_LOCALPART}:localhost (${FACTORY_ROOM_ID})"
fi

echo "[ok] matrix bot ready: ${BOT_DISPLAY_NAME} (${BOT_USER_ID})"
