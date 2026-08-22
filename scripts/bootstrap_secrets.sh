#!/usr/bin/env bash
# scripts/bootstrap_secrets.sh — Devonn.AI GitHub Secrets Bootstrap
#
# Sets all required GitHub Actions secrets for the supreme-ai-deployment-hub
# repository. Run this once after cloning or when onboarding a new environment.
#
# Prerequisites:
#   - GitHub CLI (gh) installed and authenticated: gh auth login
#   - All environment variables below must be set before running
#
# Usage:
#   export OPENAI_API_KEY="sk-..."
#   export SUPABASE_ACCESS_TOKEN="sbp_..."
#   ... (set all vars below)
#   bash scripts/bootstrap_secrets.sh
#
# To set secrets for a specific environment (staging/production):
#   bash scripts/bootstrap_secrets.sh --env staging

set -euo pipefail

REPO="wesship/supreme-ai-deployment-hub"
ENV="${1:-}"  # optional: --env staging or --env production

log()  { echo "[bootstrap_secrets] $*"; }
warn() { echo "[bootstrap_secrets] WARNING: $*" >&2; }
die()  { echo "[bootstrap_secrets] ERROR: $*" >&2; exit 1; }

# Verify gh CLI is available and authenticated
command -v gh >/dev/null 2>&1 || die "GitHub CLI (gh) not installed. Install from https://cli.github.com"
gh auth status >/dev/null 2>&1 || die "Not authenticated. Run: gh auth login"

log "Setting GitHub Actions secrets for: $REPO"
log "Environment: ${ENV:-repository-level}"
echo ""

set_secret() {
  local name="$1"
  local value="${!name:-}"
  if [ -z "$value" ]; then
    warn "Skipping $name — not set in environment"
    return
  fi
  if [ -n "$ENV" ] && [ "$ENV" = "--env" ]; then
    gh secret set "$name" --body "$value" --repo "$REPO" --env "${2:-production}"
  else
    gh secret set "$name" --body "$value" --repo "$REPO"
  fi
  log "  ✓ Set: $name"
}

# ── Frontend / Vercel ──────────────────────────────────────────────────────
set_secret VERCEL_TOKEN
set_secret VERCEL_ORG_ID
set_secret VERCEL_PROJECT_ID

# ── Supabase ───────────────────────────────────────────────────────────────
set_secret SUPABASE_ACCESS_TOKEN
set_secret SUPABASE_PROJECT_ID
set_secret SUPABASE_DB_PASSWORD
set_secret VITE_SUPABASE_URL
set_secret VITE_SUPABASE_ANON_KEY

# ── OpenAI ─────────────────────────────────────────────────────────────────
set_secret OPENAI_API_KEY

# ── AWS ────────────────────────────────────────────────────────────────────
set_secret AWS_ACCESS_KEY_ID
set_secret AWS_SECRET_ACCESS_KEY
set_secret AWS_REGION
set_secret ECR_REGISTRY
set_secret EKS_CLUSTER_NAME

# ── Security reporting ─────────────────────────────────────────────────────
set_secret CODECOV_TOKEN

# ── Observability ──────────────────────────────────────────────────────────
set_secret SENTRY_DSN
set_secret SENTRY_AUTH_TOKEN
set_secret SENTRY_ORG
set_secret SENTRY_PROJECT

# ── Backend auth ──────────────────────────────────────────────────────────
set_secret JWT_SECRET

# ── Azure (if using Azure Container Apps) ─────────────────────────────────
set_secret AZURE_CREDENTIALS
set_secret AZURE_SUBSCRIPTION_ID

echo ""
log "Bootstrap complete. Verify in GitHub:"
log "  https://github.com/$REPO/settings/secrets/actions"
