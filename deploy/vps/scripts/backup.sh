#!/bin/bash
# =============================================================================
# D3VONN.IO — Daily Backup Script
# =============================================================================
# Backs up: Redis data, Nginx configs, environment files, Docker volumes
# Retention: Configurable (default 30 days)
# Optional: Upload to S3-compatible storage
# =============================================================================

set -euo pipefail

# Configuration
PROJECT_DIR="/opt/d3vonn"
BACKUP_DIR="${PROJECT_DIR}/deploy/vps/backups"
RETENTION_DAYS="${BACKUP_RETENTION_DAYS:-30}"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
BACKUP_NAME="d3vonn_backup_${TIMESTAMP}"
BACKUP_PATH="${BACKUP_DIR}/${BACKUP_NAME}"

echo "[$(date -Iseconds)] Starting D3VONN.IO backup..."

# Create backup directory
mkdir -p "${BACKUP_PATH}"

# ── Backup Redis ─────────────────────────────────────────────────────────────
echo "[$(date -Iseconds)] Backing up Redis..."
docker exec d3vonn-redis redis-cli BGSAVE 2>/dev/null || true
sleep 2
docker cp d3vonn-redis:/data/dump.rdb "${BACKUP_PATH}/redis_dump.rdb" 2>/dev/null || \
    echo "  ⚠️ Redis backup skipped (container not running)"

# ── Backup Configuration Files ───────────────────────────────────────────────
echo "[$(date -Iseconds)] Backing up configuration..."
cp -r "${PROJECT_DIR}/deploy/vps/nginx" "${BACKUP_PATH}/nginx_config" 2>/dev/null || true
cp "${PROJECT_DIR}/deploy/vps/.env" "${BACKUP_PATH}/env_backup" 2>/dev/null || true
cp -r "${PROJECT_DIR}/deploy/vps/ssl/certs" "${BACKUP_PATH}/ssl_certs" 2>/dev/null || true

# ── Backup Docker Compose State ──────────────────────────────────────────────
echo "[$(date -Iseconds)] Saving Docker state..."
cd "${PROJECT_DIR}/deploy/vps"
docker compose ps --format json > "${BACKUP_PATH}/docker_state.json" 2>/dev/null || true
docker compose config > "${BACKUP_PATH}/docker_compose_resolved.yml" 2>/dev/null || true

# ── Backup Docker Volumes ────────────────────────────────────────────────────
echo "[$(date -Iseconds)] Backing up Docker volumes..."
for volume in $(docker volume ls --format '{{.Name}}' | grep d3vonn); do
    echo "  Backing up volume: ${volume}"
    docker run --rm \
        -v "${volume}:/source:ro" \
        -v "${BACKUP_PATH}:/backup" \
        alpine tar czf "/backup/volume_${volume}.tar.gz" -C /source . 2>/dev/null || \
        echo "  ⚠️ Volume ${volume} backup failed"
done

# ── Compress Backup ──────────────────────────────────────────────────────────
echo "[$(date -Iseconds)] Compressing backup..."
cd "${BACKUP_DIR}"
tar czf "${BACKUP_NAME}.tar.gz" "${BACKUP_NAME}"
rm -rf "${BACKUP_PATH}"

BACKUP_SIZE=$(du -sh "${BACKUP_DIR}/${BACKUP_NAME}.tar.gz" | cut -f1)
echo "[$(date -Iseconds)] Backup created: ${BACKUP_NAME}.tar.gz (${BACKUP_SIZE})"

# ── Upload to S3 (Optional) ─────────────────────────────────────────────────
if [ -n "${BACKUP_S3_BUCKET:-}" ] && [ -n "${AWS_ACCESS_KEY_ID:-}" ]; then
    echo "[$(date -Iseconds)] Uploading to S3..."
    aws s3 cp "${BACKUP_DIR}/${BACKUP_NAME}.tar.gz" \
        "s3://${BACKUP_S3_BUCKET}/backups/${BACKUP_NAME}.tar.gz" \
        --storage-class STANDARD_IA
    echo "[$(date -Iseconds)] ✓ Uploaded to s3://${BACKUP_S3_BUCKET}/backups/"
fi

# ── Cleanup Old Backups ──────────────────────────────────────────────────────
echo "[$(date -Iseconds)] Cleaning up backups older than ${RETENTION_DAYS} days..."
find "${BACKUP_DIR}" -name "d3vonn_backup_*.tar.gz" -mtime "+${RETENTION_DAYS}" -delete
REMAINING=$(find "${BACKUP_DIR}" -name "d3vonn_backup_*.tar.gz" | wc -l)
echo "[$(date -Iseconds)] ${REMAINING} backup(s) retained"

# ── Done ─────────────────────────────────────────────────────────────────────
echo "[$(date -Iseconds)] ✅ Backup complete: ${BACKUP_NAME}.tar.gz"
