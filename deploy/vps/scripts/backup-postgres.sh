#!/usr/bin/env bash
set -euo pipefail

BACKUP_DIR="${BACKUP_DIR:-/opt/d3vonn/backups}"
RETENTION_DAYS="${BACKUP_RETENTION_DAYS:-14}"
STAMP="$(date +%Y%m%d-%H%M%S)"
OUT="$BACKUP_DIR/postgres-$STAMP.sql.gz"

mkdir -p "$BACKUP_DIR"

if ! docker ps --format '{{.Names}}' | grep -Eq 'postgres|d3vonn-postgres'; then
  echo "No local Postgres container found. If using Supabase, use managed Supabase backups."
  exit 0
fi

CONTAINER="$(docker ps --format '{{.Names}}' | grep -E 'd3vonn-postgres|postgres' | head -n 1)"
USER_NAME="${POSTGRES_USER:-postgres}"
DB_NAME="${POSTGRES_DB:-postgres}"

echo "Backing up $DB_NAME from $CONTAINER to $OUT"
docker exec "$CONTAINER" pg_dump -U "$USER_NAME" "$DB_NAME" | gzip > "$OUT"

find "$BACKUP_DIR" -name 'postgres-*.sql.gz' -mtime "+$RETENTION_DAYS" -delete

echo "Backup complete: $OUT"
