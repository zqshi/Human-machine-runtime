#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT_DIR"

BASE_URL="${BASE_URL:-http://127.0.0.1:3010}"
ADMIN_USERNAME="${ADMIN_USERNAME:-admin}"
ADMIN_PASSWORD="${ADMIN_PASSWORD:-admin123}"
E2E_DIR="$ROOT_DIR/runtime/e2e"
TS="$(date +%Y%m%d-%H%M%S)"
MATRIX_LOG="$E2E_DIR/matrix-e2e-${TS}.log"
REPORT_FILE="$E2E_DIR/full-validation-${TS}.md"
COOKIE_JAR="$E2E_DIR/admin-cookie-${TS}.txt"

mkdir -p "$E2E_DIR"

json_field() {
  local key="$1"
  node -e "const fs=require('fs');const d=JSON.parse(fs.readFileSync(0,'utf8'));const v=d['$key'];if(v===undefined||v===null){process.exit(2)};process.stdout.write(String(v));"
}

echo "[step] start/check runtime stack"
bash "$ROOT_DIR/scripts/start-openclaw-stack.sh"
bash "$ROOT_DIR/scripts/start-dcf-app.sh"
bash "$ROOT_DIR/scripts/check-openclaw-stack.sh" >/dev/null
bash "$ROOT_DIR/scripts/check-dcf-app.sh" >/dev/null
bash "$ROOT_DIR/scripts/openclaw-smoke.sh" >/dev/null

echo "[step] matrix create-agent e2e"
bash "$ROOT_DIR/scripts/matrix-e2e-bootstrap.sh" | tee "$MATRIX_LOG" >/dev/null
INSTANCE_ID="$(rg '^instance_id=' "$MATRIX_LOG" | tail -n 1 | cut -d'=' -f2- || true)"
ROOM_ID="$(rg '^room_id=' "$MATRIX_LOG" | tail -n 1 | cut -d'=' -f2- || true)"
if [ -z "$INSTANCE_ID" ]; then
  echo "[error] instance_id not found in $MATRIX_LOG"
  exit 1
fi

echo "[step] admin login + api acceptance"
LOGIN_BODY="{\"username\":\"${ADMIN_USERNAME}\",\"password\":\"${ADMIN_PASSWORD}\"}"
LOGIN_RES="$(curl -fsS -c "$COOKIE_JAR" -X POST "$BASE_URL/api/auth/login" -H 'content-type: application/json' -d "$LOGIN_BODY")"
if ! echo "$LOGIN_RES" | rg -q '"authenticated":true'; then
  echo "[error] admin login failed: $LOGIN_RES"
  exit 1
fi

INSTANCE_JSON="$(curl -fsS -b "$COOKIE_JAR" "$BASE_URL/api/admin/instances/${INSTANCE_ID}")"
MATRIX_STATUS="$(echo "$INSTANCE_JSON" | node -e "const fs=require('fs');const d=JSON.parse(fs.readFileSync(0,'utf8'));const s=d&&d.checks&&d.checks.matrix&&d.checks.matrix.status;process.stdout.write(String(s||''));")"
MATRIX_ISSUES_COUNT="$(echo "$INSTANCE_JSON" | node -e "const fs=require('fs');const d=JSON.parse(fs.readFileSync(0,'utf8'));const n=Array.isArray(d&&d.checks&&d.checks.matrix&&d.checks.matrix.issues)?d.checks.matrix.issues.length:0;process.stdout.write(String(n));")"
MATRIX_CHECK_AT="$(echo "$INSTANCE_JSON" | node -e "const fs=require('fs');const d=JSON.parse(fs.readFileSync(0,'utf8'));const v=d&&d.checks&&d.checks.matrix&&d.checks.matrix.checkedAt;process.stdout.write(String(v||''));")"
if [ -z "$MATRIX_STATUS" ]; then
  echo "[error] checks.matrix.status missing on /api/admin/instances/${INSTANCE_ID}"
  exit 1
fi

SHARED_JSON="$(curl -fsS -b "$COOKIE_JAR" "$BASE_URL/api/admin/agents/shared")"
SHARED_TOTAL="$(echo "$SHARED_JSON" | node -e "const fs=require('fs');const d=JSON.parse(fs.readFileSync(0,'utf8'));const n=d&&d.summary?Number(d.summary.total||0):0;process.stdout.write(String(n));")"

SHARED_PAGE_CODE="$(curl -sS -o /dev/null -w '%{http_code}' "$BASE_URL/admin/shared-agents.html")"
if [ "$SHARED_PAGE_CODE" != "200" ]; then
  echo "[error] /admin/shared-agents.html not reachable, status=$SHARED_PAGE_CODE"
  exit 1
fi

IDENTITY_CODE="$(curl -sS -o /dev/null -w '%{http_code}' -b "$COOKIE_JAR" "$BASE_URL/api/admin/auth/identity-mappings")"
if [ "$IDENTITY_CODE" != "410" ]; then
  echo "[error] identity mapping manual endpoint should be 410, got=$IDENTITY_CODE"
  exit 1
fi

{
  echo "# 全链路验收报告"
  echo
  echo "- 时间: $(date '+%F %T %z')"
  echo "- 基础地址: $BASE_URL"
  echo "- Matrix 房间: ${ROOM_ID:-unknown}"
  echo "- 新建实例: $INSTANCE_ID"
  echo
  echo "## 验收结果"
  echo "- OpenClaw/Matrix 栈健康: PASS"
  echo "- Matrix 创建数字员工: PASS"
  echo "- 管理后台实例详情 checks.matrix: PASS"
  echo "- 共享Agent页面可访问: PASS"
  echo "- 身份映射人工维护接口禁用(410): PASS"
  echo
  echo "## 关键字段"
  echo "- checks.matrix.status: ${MATRIX_STATUS}"
  echo "- checks.matrix.issues.count: ${MATRIX_ISSUES_COUNT}"
  echo "- checks.matrix.checkedAt: ${MATRIX_CHECK_AT:-N/A}"
  echo "- sharedAgents.summary.total: ${SHARED_TOTAL}"
  echo
  echo "## 证据文件"
  echo "- Matrix E2E日志: ${MATRIX_LOG}"
  echo "- 实例详情响应片段已在运行时校验"
} > "$REPORT_FILE"

echo "[ok] full validation passed"
echo "instance_id=${INSTANCE_ID}"
echo "room_id=${ROOM_ID}"
echo "report=${REPORT_FILE}"

