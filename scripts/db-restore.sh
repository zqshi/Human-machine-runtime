#!/usr/bin/env bash
#
# HMR PostgreSQL 恢复：从备份文件恢复（gunzip → psql）。
#
# 用法：./scripts/db-restore.sh ./backups/hmr-20260101T020000Z.sql.gz
#
# ⚠️ 恢复会覆盖现有数据（备份用了 --clean --if-exists）。
#   生产恢复前：先停应用 → 确认目标库 → 执行 → 验证 → 启动应用。
#
set -euo pipefail

DB_URL="${DATABASE_URL:-postgresql://hmr:hmr@localhost:5435/hmr}"
FILE="${1:-}"

if [ -z "$FILE" ]; then
  echo "usage: $0 <backup-file>" >&2
  exit 2
fi
if [ ! -f "$FILE" ]; then
  echo "backup not found: $FILE" >&2
  exit 1
fi

echo "[$(date -u +%FT%TZ)] restoring $FILE → $DB_URL"
echo "WARNING: this OVERWRITES existing data. Ctrl+C within 5s to abort."
sleep 5

gunzip -c "$FILE" | psql "$DB_URL"

echo "[$(date -u +%FT%TZ)] restore complete — verify data before starting the app"
