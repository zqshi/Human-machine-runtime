#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT_DIR"

BROWSER_USE_PROJECT="${BROWSER_USE_PROJECT:-/Users/zqs/Downloads/project/browser-use}"
SESSION_NAME="${BROWSER_USE_SESSION_NAME:-dcf-user-e2e}"
APP_URL="${DCF_BASE_URL:-http://127.0.0.1:3010}"
E2E_DIR="$ROOT_DIR/runtime/e2e"
AGENT_NAME="${MATRIX_AGENT_NAME:-browser-e2e-agent-$(date +%H%M%S)}"
MATRIX_OUTPUT_FILE="$E2E_DIR/matrix-e2e-${AGENT_NAME}.log"
SCREENSHOT_FILE="$E2E_DIR/browser-use-employees-${AGENT_NAME}.png"

mkdir -p "$E2E_DIR"

bu() {
  uv run --project "$BROWSER_USE_PROJECT" browser-use "$@"
}

ensure_prerequisites() {
  command -v uv >/dev/null 2>&1 || { echo "[error] uv not found"; exit 1; }
  [ -d "$BROWSER_USE_PROJECT" ] || { echo "[error] browser-use project not found: $BROWSER_USE_PROJECT"; exit 1; }
  bu --help >/dev/null 2>&1 || { echo "[error] browser-use unavailable from project: $BROWSER_USE_PROJECT"; exit 1; }
}

ensure_stacks() {
  if bash scripts/check-openclaw-stack.sh >/dev/null 2>&1; then
    echo "[e2e] openclaw stack already healthy"
  else
    echo "[e2e] openclaw stack not healthy, starting"
    MATRIX_RESTART_ON_START=false bash scripts/start-openclaw-stack.sh
  fi

  if bash scripts/check-dcf-app.sh >/dev/null 2>&1; then
    echo "[e2e] dcf app already healthy"
  else
    echo "[e2e] dcf app not healthy, starting"
    bash scripts/start-dcf-app.sh
  fi
}

create_agent_from_matrix() {
  echo "[e2e] matrix create-agent start: $AGENT_NAME"
  MATRIX_AGENT_NAME="$AGENT_NAME" bash scripts/matrix-e2e-bootstrap.sh | tee "$MATRIX_OUTPUT_FILE"
  INSTANCE_ID="$(rg '^instance_id=' "$MATRIX_OUTPUT_FILE" | tail -n 1 | cut -d'=' -f2- || true)"
  ROOM_ID="$(rg '^room_id=' "$MATRIX_OUTPUT_FILE" | tail -n 1 | cut -d'=' -f2- || true)"
  if [ -z "${INSTANCE_ID:-}" ]; then
    echo "[error] failed to parse instance_id from $MATRIX_OUTPUT_FILE"
    exit 1
  fi
  echo "[e2e] matrix create-agent done: instance_id=$INSTANCE_ID room_id=${ROOM_ID:-unknown}"
}

admin_login_and_assert_employee() {
  bu --session "$SESSION_NAME" close >/dev/null 2>&1 || true
  bu --session "$SESSION_NAME" open "$APP_URL/admin/login.html" >/dev/null

  bu --session "$SESSION_NAME" eval \
    "document.getElementById('username').value='admin';document.getElementById('password').value='admin123';document.getElementById('bridgeLoginForm').dispatchEvent(new Event('submit',{bubbles:true,cancelable:true}));'submitted'" >/dev/null

  bu --session "$SESSION_NAME" wait text "总览" --timeout 15000 >/dev/null || true
  bu --session "$SESSION_NAME" open "$APP_URL/admin/employees.html" >/dev/null
  bu --session "$SESSION_NAME" wait text "员工总览" --timeout 15000 >/dev/null

  bu --session "$SESSION_NAME" eval \
    "const el=document.getElementById('employeeKeyword');el.value='${AGENT_NAME}';el.dispatchEvent(new KeyboardEvent('keydown',{key:'Enter',bubbles:true}));'search'" >/dev/null

  FOUND="false"
  for _ in $(seq 1 20); do
    OUT="$(bu --session "$SESSION_NAME" eval "document.body.innerText.includes('${AGENT_NAME}')")"
    if echo "$OUT" | rg -qi 'result:[[:space:]]*true'; then
      FOUND="true"
      break
    fi
    sleep 1
  done

  bu --session "$SESSION_NAME" screenshot "$SCREENSHOT_FILE" >/dev/null || true

  if [ "$FOUND" != "true" ]; then
    echo "[error] employee not visible in admin employees page: $AGENT_NAME"
    echo "[hint] screenshot: $SCREENSHOT_FILE"
    exit 1
  fi
  echo "[ok] admin employee visible: $AGENT_NAME"
  echo "[ok] screenshot saved: $SCREENSHOT_FILE"
}

main() {
  ensure_prerequisites
  ensure_stacks
  create_agent_from_matrix
  admin_login_and_assert_employee
  echo "[ok] browser-use user e2e passed"
  echo "agent_name=$AGENT_NAME"
  echo "instance_id=$INSTANCE_ID"
}

main "$@"
