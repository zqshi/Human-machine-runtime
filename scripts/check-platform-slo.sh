#!/usr/bin/env bash
set -euo pipefail

BASE_URL="${BASE_URL:-http://127.0.0.1:3000}"
AUTH_TOKEN="${AUTH_TOKEN:-}"
AUDIT_FORMAT="${AUDIT_FORMAT:-ndjson}"
TIMEOUT_SEC="${TIMEOUT_SEC:-10}"

echo "[check] base_url=${BASE_URL}"

fetch() {
  local url="$1"
  if [[ -n "${AUTH_TOKEN}" ]]; then
    curl -fsS --max-time "${TIMEOUT_SEC}" \
      -H "Authorization: Bearer ${AUTH_TOKEN}" \
      "$url"
  else
    curl -fsS --max-time "${TIMEOUT_SEC}" "$url"
  fi
}

health_json="$(fetch "${BASE_URL}/health")"
status_json="$(fetch "${BASE_URL}/status")"
metrics_text="$(fetch "${BASE_URL}/metrics")"

echo "[ok] /health reachable"
echo "[ok] /status reachable"
echo "[ok] /metrics reachable"

if ! grep -q 'dcf_health_state' <<<"${metrics_text}"; then
  echo "[fail] metrics missing dcf_health_state"
  exit 1
fi
if ! grep -q 'dcf_instance_state_total' <<<"${metrics_text}"; then
  echo "[fail] metrics missing dcf_instance_state_total"
  exit 1
fi

health_level="$(echo "${status_json}" | node -e "let s='';process.stdin.on('data',d=>s+=d);process.stdin.on('end',()=>{try{const j=JSON.parse(s);process.stdout.write(String(j.healthLevel||''));}catch{process.stdout.write('');}})")"
if [[ "${health_level}" != "healthy" && "${health_level}" != "degraded" && "${health_level}" != "unhealthy" ]]; then
  echo "[fail] invalid healthLevel in /status: ${health_level}"
  exit 1
fi

echo "[ok] status.healthLevel=${health_level}"

if [[ -n "${AUTH_TOKEN}" ]]; then
  audit_export="$(fetch "${BASE_URL}/api/control/audits/export?format=${AUDIT_FORMAT}&limit=10")"
  echo "[ok] /api/control/audits/export reachable with token"
  if [[ "${AUDIT_FORMAT}" == "ndjson" ]]; then
    if [[ -n "${audit_export}" ]] && ! head -n 1 <<<"${audit_export}" | grep -q '{'; then
      echo "[fail] audit ndjson export format looks invalid"
      exit 1
    fi
  else
    if ! grep -q '"success"' <<<"${audit_export}"; then
      echo "[fail] audit json export format looks invalid"
      exit 1
    fi
  fi
else
  echo "[warn] AUTH_TOKEN is empty; skip protected audit export check"
fi

echo "[done] platform slo check passed"
