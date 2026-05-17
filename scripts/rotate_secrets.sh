#!/usr/bin/env bash
# rotate_secrets.sh — Automated secret rotation for Devonn.AI
# Rotates: AWS IAM key, JWT secret, Encryption key
# Updates: GitHub Actions Secrets, .env.example
# Usage: bash scripts/rotate_secrets.sh [--dry-run]
set -euo pipefail

DRY_RUN=false
[[ "${1:-}" == "--dry-run" ]] && DRY_RUN=true

REPO="${REPO:-wesship/supreme-ai-deployment-hub}"

log() { echo "[$(date '+%H:%M:%S')] $*"; }
run() {
  if $DRY_RUN; then
    echo "[DRY-RUN] $*"
  else
    eval "$@"
  fi
}

# ── Verify prerequisites ─────────────────────────────────────────────────────
for cmd in aws gh openssl; do
  command -v "$cmd" &>/dev/null || { echo "ERROR: $cmd not installed"; exit 1; }
done

log "Starting secret rotation for $REPO"
$DRY_RUN && log "DRY-RUN mode — no changes will be made"

# ── 1. Rotate JWT Secret ──────────────────────────────────────────────────────
log "Rotating JWT_SECRET..."
NEW_JWT_SECRET=$(openssl rand -base64 64 | tr -d '\n')
run "gh secret set JWT_SECRET --body '$NEW_JWT_SECRET' --repo '$REPO'"
log "  ✓ JWT_SECRET rotated"

# ── 2. Rotate Encryption Key ─────────────────────────────────────────────────
log "Rotating ENCRYPTION_KEY..."
NEW_ENC_KEY=$(openssl rand -hex 32)
run "gh secret set ENCRYPTION_KEY --body '$NEW_ENC_KEY' --repo '$REPO'"
log "  ✓ ENCRYPTION_KEY rotated"

# ── 3. Rotate AWS IAM Key ────────────────────────────────────────────────────
if [ -n "${AWS_IAM_USER:-}" ]; then
  log "Rotating AWS IAM key for user: $AWS_IAM_USER"

  # Create new key
  NEW_KEY_JSON=$(aws iam create-access-key --user-name "$AWS_IAM_USER" 2>/dev/null || echo "{}")
  if [ "$NEW_KEY_JSON" != "{}" ]; then
    NEW_ACCESS_KEY=$(echo "$NEW_KEY_JSON" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d['AccessKey']['AccessKeyId'])")
    NEW_SECRET_KEY=$(echo "$NEW_KEY_JSON" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d['AccessKey']['SecretAccessKey'])")

    run "gh secret set AWS_ACCESS_KEY_ID --body '$NEW_ACCESS_KEY' --repo '$REPO'"
    run "gh secret set AWS_SECRET_ACCESS_KEY --body '$NEW_SECRET_KEY' --repo '$REPO'"

    # Delete old key
    OLD_KEY="${AWS_ACCESS_KEY_ID:-}"
    if [ -n "$OLD_KEY" ]; then
      run "aws iam delete-access-key --user-name '$AWS_IAM_USER' --access-key-id '$OLD_KEY'"
    fi
    log "  ✓ AWS IAM key rotated"
  else
    log "  SKIP: Could not create new AWS IAM key (check permissions)"
  fi
else
  log "  SKIP: AWS_IAM_USER not set — skipping AWS key rotation"
fi

# ── 4. Untrack .env if committed ─────────────────────────────────────────────
if git -C . ls-files --error-unmatch .env &>/dev/null 2>&1; then
  log "Untracking .env from git..."
  run "git rm --cached .env"
  run "echo '.env' >> .gitignore"
  run "git add .gitignore"
  run "git commit -m 'security: untrack .env file'"
  log "  ✓ .env untracked"
else
  log "  OK: .env is not tracked by git"
fi

echo ""
log "════════════════════════════════════════════════════════"
log "✓ Secret rotation complete."
log ""
log "IMPORTANT: Manually rotate these in their dashboards:"
log "  - OPENAI_API_KEY  → https://platform.openai.com/api-keys"
log "  - Supabase service_role key → Supabase Dashboard → Settings → API"
log "  - RDS_DB_PASSWORD → AWS RDS Console → Modify instance"
