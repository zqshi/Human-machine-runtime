#!/usr/bin/env bash
#
# HMR PostgreSQL 全量备份：pg_dump → gzip → 按天保留轮转。
#
# 用法：
#   ./scripts/db-backup.sh                              # 用默认连接串
#   DATABASE_URL=postgresql://... ./scripts/db-backup.sh
#   BACKUP_DIR=/data/backups BACKUP_RETENTION_DAYS=30 ./scripts/db-backup.sh
#
# 生产建议 cron：0 2 * * * cd /app && ./scripts/db-backup.sh >> /var/log/hmr-backup.log 2>&1
#
set -euo pipefail

DB_URL="${DATABASE_URL:-postgresql://hmr:hmr@localhost:5435/hmr}"
BACKUP_DIR="${BACKUP_DIR:-./backups}"
RETENTION_DAYS="${BACKUP_RETENTION_DAYS:-30}"

mkdir -p "$BACKUP_DIR"

TIMESTAMP="$(date -u +%Y%m%dT%H%M%SZ)"
FILE="$BACKUP_DIR/hmr-$TIMESTAMP.sql.gz"

echo "[$(date -u +%FT%TZ)] backing up → $FILE"
# --clean --if-exists：恢复时先 DROP 再建，保证幂等恢复
pg_dump --no-owner --clean --if-exists "$DB_URL" | gzip > "$FILE"

# 保留轮转：删除超过 RETENTION_DAYS 天的备份
find "$BACKUP_DIR" -maxdepth 1 -name 'hmr-*.sql.gz' -type f -mtime +"$RETENTION_DAYS" -delete
remaining="$(find "$BACKUP_DIR" -maxdepth 1 -name 'hmr-*.sql.gz' -type f | wc -l | tr -d ' ')"

echo "[$(date -u +%FT%TZ)] done. size=$(du -h "$FILE" | cut -f1), retained=$remaining (>${RETENTION_DAYS}d pruned)"
