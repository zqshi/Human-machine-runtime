#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
COMPOSE_FILE="$ROOT_DIR/deploy/local/docker-compose.openclaw-matrix.yml"


echo "[docker compose ps]"
docker compose -f "$COMPOSE_FILE" ps

echo
echo "[matrix versions]"
curl -fsS http://127.0.0.1:8008/_matrix/client/versions | head -c 400; echo

echo
echo "[openclaw ui]"
curl -I -sS http://127.0.0.1:18789/ | sed -n '1,12p'

echo
echo "[matrix element web]"
curl -I -sS http://127.0.0.1:8081/ | sed -n '1,12p'

echo
echo "[openclaw gateway logs tail]"
docker logs --tail 40 dcf-openclaw-gateway || true
