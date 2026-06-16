#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
COMPOSE_FILE="${ROOT_DIR}/deploy/observability/docker-compose.yml"

docker compose -f "${COMPOSE_FILE}" up -d
echo "[ok] observability stack started"
echo "prometheus:  http://127.0.0.1:9090"
echo "alertmanager: http://127.0.0.1:9093"
echo "grafana:     http://127.0.0.1:3001 (admin/admin)"
