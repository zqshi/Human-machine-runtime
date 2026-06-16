#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
COMPOSE_FILE="${ROOT_DIR}/deploy/observability/docker-compose.yml"

docker compose -f "${COMPOSE_FILE}" ps

curl -fsS --max-time 5 "http://127.0.0.1:9090/-/ready" >/dev/null
curl -fsS --max-time 5 "http://127.0.0.1:9093/-/ready" >/dev/null
curl -fsS --max-time 5 "http://127.0.0.1:3001/api/health" >/dev/null

echo "[ok] observability stack is healthy"
