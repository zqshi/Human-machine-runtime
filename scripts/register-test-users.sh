#!/usr/bin/env bash
set -euo pipefail
#
# 注册测试用户到 Synapse (Matrix) + HMR 后端
#
# 前置条件: hmr-matrix-synapse 容器运行中
#
# 账号 (密码统一 test123):
#   test1 — 管理者   (tenant_admin)
#   test2 — 执行者   (tenant_ops)
#   test3 — 执行者   (tenant_ops)
#   test4 — 执行者   (tenant_ops)
#   test5 — 审计员   (tenant_auditor)
#

MATRIX_HS="${MATRIX_HS:-http://127.0.0.1:8008}"

wait_matrix() {
  for _ in $(seq 1 30); do
    if curl -fsS "${MATRIX_HS}/_matrix/client/versions" >/dev/null 2>&1; then
      return 0
    fi
    sleep 1
  done
  echo "[error] Matrix homeserver not reachable at ${MATRIX_HS}"
  exit 1
}

register_user() {
  local user="$1" pass="$2" display="$3"
  echo -n "  registering ${user}... "

  if docker ps --format '{{.Names}}' | grep -q '^hmr-matrix-synapse$'; then
    docker exec hmr-matrix-synapse register_new_matrix_user \
      --exists-ok --no-admin \
      -u "$user" -p "$pass" \
      -c /data/homeserver.yaml "http://localhost:8008" >/dev/null 2>&1
  else
    curl -sS -X POST "${MATRIX_HS}/_matrix/client/v3/register" \
      -H 'content-type: application/json' \
      -d "{\"username\":\"${user}\",\"password\":\"${pass}\",\"auth\":{\"type\":\"m.login.dummy\"}}" >/dev/null 2>&1 || true
  fi

  local login_res
  login_res="$(curl -sS -X POST "${MATRIX_HS}/_matrix/client/v3/login" \
    -H 'content-type: application/json' \
    -d "{\"type\":\"m.login.password\",\"identifier\":{\"type\":\"m.id.user\",\"user\":\"${user}\"},\"password\":\"${pass}\"}" 2>/dev/null)"

  local token
  token="$(echo "$login_res" | node -e "const d=JSON.parse(require('fs').readFileSync(0,'utf8'));process.stdout.write(d.access_token||'')" 2>/dev/null || true)"

  if [ -n "$token" ]; then
    local user_id="@${user}:localhost"
    local enc_uid
    enc_uid="$(node -e "process.stdout.write(encodeURIComponent(process.argv[1]))" "$user_id")"
    curl -sS -X PUT "${MATRIX_HS}/_matrix/client/v3/profile/${enc_uid}/displayname" \
      -H "Authorization: Bearer ${token}" \
      -H 'content-type: application/json' \
      -d "{\"displayname\":\"${display}\"}" >/dev/null 2>&1 || true
    echo "done (display: ${display})"
  else
    echo "done (display name skipped)"
  fi
}

echo "[register-test-users] Waiting for Matrix homeserver..."
wait_matrix

echo "[register-test-users] Registering test users on ${MATRIX_HS}:"
register_user "test1" "test123" "测试用户1"
register_user "test2" "test123" "测试用户2"
register_user "test3" "test123" "测试用户3"
register_user "test4" "test123" "测试用户4"
register_user "test5" "test123" "测试用户5"

echo ""
echo "=== 测试账号 (密码统一: test123) ==="
echo ""
echo "  test1 — 管理者 (tenant_admin)   @test1:localhost"
echo "  test2 — 执行者 (tenant_ops)     @test2:localhost"
echo "  test3 — 执行者 (tenant_ops)     @test3:localhost"
echo "  test4 — 执行者 (tenant_ops)     @test4:localhost"
echo "  test5 — 审计员 (tenant_auditor)  @test5:localhost"
echo ""
echo "  前端登录 Homeserver: http://127.0.0.1:5176"
echo ""
