#!/usr/bin/env bash
set -euo pipefail

BACKUP_ROOT="${BACKUP_ROOT:-/var/backups/d3vonn}"
SOURCE_ROOT="${SOURCE_ROOT:-/opt/supreme-ai-deployment-hub}"
STAMP="$(date -u +%Y%m%dT%H%M%SZ)"
WORKDIR="$(mktemp -d)"
ARCHIVE="${BACKUP_ROOT}/d3vonn-ops-${STAMP}.tar.gz"
trap 'rm -rf "$WORKDIR"' EXIT

install -d -m 0700 "$BACKUP_ROOT" "$WORKDIR/config"

copy_if_present() {
  local source="$1" destination="$2"
  if [[ -f "$source" ]]; then
    install -m 0600 "$source" "$WORKDIR/config/$destination"
  fi
}

copy_if_present "$SOURCE_ROOT/docker-compose.yml" docker-compose.yml
copy_if_present "$SOURCE_ROOT/compose.yaml" compose.yaml
copy_if_present "$SOURCE_ROOT/nginx/nginx.conf" nginx.conf
copy_if_present "$SOURCE_ROOT/docs/operations/RECOVERY_RUNBOOK.md" RECOVERY_RUNBOOK.md

iptables-save > "$WORKDIR/config/iptables.rules"
if command -v ip6tables-save >/dev/null 2>&1; then
  ip6tables-save > "$WORKDIR/config/ip6tables.rules"
fi
systemctl is-enabled netfilter-persistent > "$WORKDIR/config/netfilter-persistent.enabled" 2>&1 || true
docker compose -f "$SOURCE_ROOT/docker-compose.yml" config > "$WORKDIR/config/compose.rendered.yml" 2>/dev/null || true

# Never archive plaintext .env files. Encrypt them independently when AGE_RECIPIENT is set.
if [[ -n "${AGE_RECIPIENT:-}" ]] && command -v age >/dev/null 2>&1; then
  while IFS= read -r -d '' env_file; do
    relative="${env_file#${SOURCE_ROOT}/}"
    safe_name="${relative//\//_}.age"
    age --recipient "$AGE_RECIPIENT" --output "$WORKDIR/config/$safe_name" "$env_file"
  done < <(find "$SOURCE_ROOT" -maxdepth 2 -type f -name '.env*' -print0)
fi

find "$WORKDIR/config" -type f -exec sha256sum {} + > "$WORKDIR/SHA256SUMS"
tar -C "$WORKDIR" -czf "$ARCHIVE" config SHA256SUMS
chmod 0600 "$ARCHIVE"

# Retain 30 daily backups by default.
find "$BACKUP_ROOT" -type f -name 'd3vonn-ops-*.tar.gz' -mtime +"${BACKUP_RETENTION_DAYS:-30}" -delete

echo "$ARCHIVE"
