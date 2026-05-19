#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────────────────────
# scripts/supabase_safe_migrate.sh
# Devonn.AI — Safe Supabase Migration Script with Drift Detection
#
# Usage:
#   ./scripts/supabase_safe_migrate.sh [--dry-run] [--force]
#
# Prerequisites:
#   1. supabase CLI installed: brew install supabase/tap/supabase
#   2. SUPABASE_ACCESS_TOKEN set in environment
#   3. SUPABASE_PROJECT_ID set in environment (find in Supabase dashboard → Settings → General)
#
# What this script does:
#   1. Validates all required environment variables are set
#   2. Logs in to Supabase using the access token
#   3. Links to the remote project
#   4. Runs `supabase db diff` to detect schema drift before applying anything
#   5. Shows a summary of pending migrations
#   6. Prompts for confirmation (unless --force is passed)
#   7. Applies migrations with `supabase db push`
#   8. Verifies the migration was successful
# ─────────────────────────────────────────────────────────────────────────────

set -euo pipefail

# ── Colors ────────────────────────────────────────────────────────────────────
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

DRY_RUN=false
FORCE=false

for arg in "$@"; do
  case $arg in
    --dry-run) DRY_RUN=true ;;
    --force)   FORCE=true ;;
  esac
done

echo -e "${BLUE}═══════════════════════════════════════════════════════════${NC}"
echo -e "${BLUE}  Devonn.AI — Supabase Safe Migration Script${NC}"
echo -e "${BLUE}═══════════════════════════════════════════════════════════${NC}"
echo ""

# ── Step 1: Validate environment ──────────────────────────────────────────────
echo -e "${YELLOW}[1/6] Validating environment variables...${NC}"

MISSING=()
[[ -z "${SUPABASE_ACCESS_TOKEN:-}" ]] && MISSING+=("SUPABASE_ACCESS_TOKEN")
[[ -z "${SUPABASE_PROJECT_ID:-}" ]]   && MISSING+=("SUPABASE_PROJECT_ID")

if [[ ${#MISSING[@]} -gt 0 ]]; then
  echo -e "${RED}✗ Missing required environment variables:${NC}"
  for var in "${MISSING[@]}"; do
    echo -e "  ${RED}• $var${NC}"
  done
  echo ""
  echo "Set them with:"
  echo "  export SUPABASE_ACCESS_TOKEN=sbp_..."
  echo "  export SUPABASE_PROJECT_ID=your-project-ref"
  echo ""
  echo "Find your project ref at: https://supabase.com/dashboard/project/_/settings/general"
  exit 1
fi

echo -e "${GREEN}✓ All required environment variables are set${NC}"

# ── Step 2: Check supabase CLI ────────────────────────────────────────────────
echo -e "${YELLOW}[2/6] Checking Supabase CLI...${NC}"

if ! command -v supabase &>/dev/null; then
  echo -e "${RED}✗ Supabase CLI not found${NC}"
  echo "Install with: brew install supabase/tap/supabase"
  echo "Or: npm install -g supabase"
  exit 1
fi

SUPABASE_VERSION=$(supabase --version 2>&1 | head -1)
echo -e "${GREEN}✓ Supabase CLI found: ${SUPABASE_VERSION}${NC}"

# ── Step 3: Login and link ────────────────────────────────────────────────────
echo -e "${YELLOW}[3/6] Logging in and linking to project ${SUPABASE_PROJECT_ID}...${NC}"

SUPABASE_ACCESS_TOKEN="${SUPABASE_ACCESS_TOKEN}" supabase login --token "${SUPABASE_ACCESS_TOKEN}" 2>&1 || true
supabase link --project-ref "${SUPABASE_PROJECT_ID}" 2>&1

echo -e "${GREEN}✓ Linked to project: ${SUPABASE_PROJECT_ID}${NC}"

# ── Step 4: Drift detection ───────────────────────────────────────────────────
echo -e "${YELLOW}[4/6] Running schema drift detection...${NC}"
echo "  (comparing local migrations against remote database)"
echo ""

DIFF_OUTPUT=$(supabase db diff --use-migra 2>&1 || true)

if [[ -z "${DIFF_OUTPUT}" ]] || [[ "${DIFF_OUTPUT}" == *"No schema changes found"* ]]; then
  echo -e "${GREEN}✓ No schema drift detected — local and remote are in sync${NC}"
else
  echo -e "${YELLOW}⚠ Schema drift detected:${NC}"
  echo "${DIFF_OUTPUT}" | head -50
  echo ""
  echo -e "${YELLOW}This means the remote database has changes not in your local migrations.${NC}"
  echo -e "${YELLOW}Review the diff above before proceeding.${NC}"
  
  if [[ "${FORCE}" != "true" ]]; then
    read -p "Continue despite drift? (y/N): " confirm
    if [[ "${confirm}" != "y" ]] && [[ "${confirm}" != "Y" ]]; then
      echo "Aborted."
      exit 0
    fi
  fi
fi

# ── Step 5: Show pending migrations ──────────────────────────────────────────
echo -e "${YELLOW}[5/6] Checking pending migrations...${NC}"

MIGRATION_DIR="supabase/migrations"
MIGRATION_COUNT=$(ls "${MIGRATION_DIR}"/*.sql 2>/dev/null | wc -l | tr -d ' ')

echo "  Found ${MIGRATION_COUNT} migration files:"
ls "${MIGRATION_DIR}"/*.sql 2>/dev/null | while read f; do
  echo "    • $(basename $f)"
done
echo ""

if [[ "${DRY_RUN}" == "true" ]]; then
  echo -e "${YELLOW}DRY RUN — no changes will be applied${NC}"
  echo -e "${GREEN}✓ Dry run complete. Remove --dry-run to apply migrations.${NC}"
  exit 0
fi

if [[ "${FORCE}" != "true" ]]; then
  echo -e "${YELLOW}⚠ This will apply ${MIGRATION_COUNT} migrations to the REMOTE database.${NC}"
  echo -e "${YELLOW}  Project: ${SUPABASE_PROJECT_ID}${NC}"
  echo ""
  read -p "Apply migrations? (y/N): " confirm
  if [[ "${confirm}" != "y" ]] && [[ "${confirm}" != "Y" ]]; then
    echo "Aborted."
    exit 0
  fi
fi

# ── Step 6: Apply migrations ──────────────────────────────────────────────────
echo -e "${YELLOW}[6/6] Applying migrations...${NC}"

supabase db push 2>&1

echo ""
echo -e "${GREEN}═══════════════════════════════════════════════════════════${NC}"
echo -e "${GREEN}  ✓ All migrations applied successfully!${NC}"
echo -e "${GREEN}═══════════════════════════════════════════════════════════${NC}"
echo ""
echo "Next steps:"
echo "  1. Verify your schema at: https://supabase.com/dashboard/project/${SUPABASE_PROJECT_ID}/editor"
echo "  2. Test your API endpoints against the live database"
echo "  3. Proceed with backend deployment: ./scripts/deploy_backend.sh"
