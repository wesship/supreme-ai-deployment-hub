#!/usr/bin/env bash
# scripts/apply_migrations.sh — Devonn.AI Supabase Migration Runner
#
# Applies all pending Supabase database migrations to the target environment.
# Supports staging and production environments.
#
# Prerequisites:
#   - Supabase CLI installed: npm install -g supabase
#   - SUPABASE_ACCESS_TOKEN set in environment
#   - SUPABASE_PROJECT_ID set in environment
#
# Usage:
#   # Staging (dry-run first)
#   SUPABASE_ACCESS_TOKEN=sbp_... SUPABASE_PROJECT_ID=... bash scripts/apply_migrations.sh --env staging --dry-run
#
#   # Production
#   SUPABASE_ACCESS_TOKEN=sbp_... SUPABASE_PROJECT_ID=... bash scripts/apply_migrations.sh --env production

set -euo pipefail

ENV="staging"
DRY_RUN=false

while [[ $# -gt 0 ]]; do
  case "$1" in
    --env) ENV="$2"; shift 2 ;;
    --dry-run) DRY_RUN=true; shift ;;
    *) echo "Unknown argument: $1"; exit 1 ;;
  esac
done

log()  { echo "[apply_migrations] [$ENV] $*"; }
die()  { echo "[apply_migrations] ERROR: $*" >&2; exit 1; }

# Validate prerequisites
command -v supabase >/dev/null 2>&1 || die "Supabase CLI not installed. Run: npm install -g supabase"
[ -z "${SUPABASE_ACCESS_TOKEN:-}" ] && die "SUPABASE_ACCESS_TOKEN not set"
[ -z "${SUPABASE_PROJECT_ID:-}" ]   && die "SUPABASE_PROJECT_ID not set"

log "Target environment: $ENV"
log "Project ID: $SUPABASE_PROJECT_ID"
log "Dry run: $DRY_RUN"
echo ""

# Count pending migrations
MIGRATION_DIR="supabase/migrations"
MIGRATION_COUNT=$(ls "$MIGRATION_DIR"/*.sql 2>/dev/null | wc -l)
log "Found $MIGRATION_COUNT migration files in $MIGRATION_DIR"
echo ""

if [ "$DRY_RUN" = true ]; then
  log "DRY RUN — showing diff only, not applying changes"
  supabase db diff \
    --project-ref "$SUPABASE_PROJECT_ID" \
    --linked
  log "Dry run complete. Run without --dry-run to apply."
  exit 0
fi

# Production gate — require explicit confirmation
if [ "$ENV" = "production" ]; then
  echo ""
  echo "⚠️  You are about to apply migrations to PRODUCTION."
  echo "   Project: $SUPABASE_PROJECT_ID"
  echo "   Migrations: $MIGRATION_COUNT files"
  echo ""
  read -r -p "Type 'yes-production' to confirm: " CONFIRM
  [ "$CONFIRM" = "yes-production" ] || die "Aborted by user."
fi

# Apply migrations
log "Applying migrations..."
supabase db push \
  --project-ref "$SUPABASE_PROJECT_ID" \
  --password "${SUPABASE_DB_PASSWORD:-}"

log "Migrations applied successfully."
echo ""

# Verify
log "Running post-migration health check..."
supabase db diff \
  --project-ref "$SUPABASE_PROJECT_ID" \
  --linked 2>/dev/null | grep -q "No schema changes" && \
  log "✓ Schema is in sync — no pending changes." || \
  log "⚠️  Some changes may still be pending. Review the diff above."
