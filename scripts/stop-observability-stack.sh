#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
COMPOSE_FILE="${ROOT_DIR}/deploy/observability/docker-compose.yml"

docker compose -f "${COMPOSE_FILE}" down
echo "[ok] observability stack stopped"
