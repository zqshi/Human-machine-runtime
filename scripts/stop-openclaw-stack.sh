#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
COMPOSE_FILE="$ROOT_DIR/deploy/local/docker-compose.openclaw-matrix.yml"

docker compose -f "$COMPOSE_FILE" down
