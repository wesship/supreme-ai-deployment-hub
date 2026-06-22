#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────────────────────
# scripts/deploy_frontend.sh
# Devonn.AI — Vercel Frontend Deployment Script
#
# Usage:
#   ./scripts/deploy_frontend.sh              # Deploy to production
#   ./scripts/deploy_frontend.sh --preview    # Deploy a preview
#   ./scripts/deploy_frontend.sh --env-only   # Only sync env vars, no deploy
#
# Prerequisites:
#   - VERCEL_TOKEN set in environment
#   - VERCEL_ORG_ID set in environment
#   - VERCEL_PROJECT_ID set in environment
#   - VITE_API_URL set (your backend URL, e.g. https://api.d3vonn.io)
#   - VITE_SUPABASE_URL set
#   - VITE_SUPABASE_ANON_KEY set
# ─────────────────────────────────────────────────────────────────────────────

set -euo pipefail

RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'; BLUE='\033[0;34m'; NC='\033[0m'

PREVIEW=false
ENV_ONLY=false

for arg in "$@"; do
  case $arg in
    --preview)  PREVIEW=true ;;
    --env-only) ENV_ONLY=true ;;
  esac
done

echo -e "${BLUE}═══════════════════════════════════════════════════════════${NC}"
echo -e "${BLUE}  Devonn.AI — Vercel Frontend Deployment${NC}"
echo -e "${BLUE}═══════════════════════════════════════════════════════════${NC}"
echo ""

# ── Validate required secrets ─────────────────────────────────────────────────
echo -e "${YELLOW}[1/4] Validating environment variables...${NC}"

MISSING=()
[[ -z "${VERCEL_TOKEN:-}" ]]      && MISSING+=("VERCEL_TOKEN")
[[ -z "${VERCEL_ORG_ID:-}" ]]     && MISSING+=("VERCEL_ORG_ID")
[[ -z "${VERCEL_PROJECT_ID:-}" ]] && MISSING+=("VERCEL_PROJECT_ID")

if [[ ${#MISSING[@]} -gt 0 ]]; then
  echo -e "${RED}✗ Missing required environment variables:${NC}"
  for v in "${MISSING[@]}"; do echo -e "  ${RED}• $v${NC}"; done
  echo ""
  echo "Get these from:"
  echo "  VERCEL_TOKEN:      https://vercel.com/account/tokens"
  echo "  VERCEL_ORG_ID:     Vercel dashboard → Settings → General → Team ID"
  echo "  VERCEL_PROJECT_ID: Vercel dashboard → your project → Settings → General"
  exit 1
fi

echo -e "${GREEN}✓ Vercel credentials validated${NC}"

# ── Sync environment variables to Vercel ─────────────────────────────────────
echo -e "${YELLOW}[2/4] Syncing environment variables to Vercel...${NC}"

set_vercel_env() {
  local KEY="$1"
  local VALUE="$2"
  local TARGET="${3:-production}"  # production, preview, development

  if [[ -z "${VALUE}" ]]; then
    echo "  ⚠ Skipping ${KEY} (empty value)"
    return
  fi

  # Delete existing then re-add (idempotent)
  curl -s -X DELETE \
    "https://api.vercel.com/v9/projects/${VERCEL_PROJECT_ID}/env?key=${KEY}&target=${TARGET}" \
    -H "Authorization: Bearer ${VERCEL_TOKEN}" > /dev/null 2>&1 || true

  RESPONSE=$(curl -s -X POST \
    "https://api.vercel.com/v9/projects/${VERCEL_PROJECT_ID}/env" \
    -H "Authorization: Bearer ${VERCEL_TOKEN}" \
    -H "Content-Type: application/json" \
    -d "{\"key\":\"${KEY}\",\"value\":\"${VALUE}\",\"type\":\"encrypted\",\"target\":[\"${TARGET}\"]}")

  if echo "${RESPONSE}" | python3 -c "import json,sys; d=json.load(sys.stdin); exit(0 if d.get('id') else 1)" 2>/dev/null; then
    echo -e "  ${GREEN}✓ ${KEY} set for ${TARGET}${NC}"
  else
    echo -e "  ${YELLOW}⚠ ${KEY}: $(echo ${RESPONSE} | python3 -c "import json,sys; d=json.load(sys.stdin); print(d.get('error',{}).get('message','unknown error'))" 2>/dev/null)${NC}"
  fi
}

# Set all required frontend environment variables
set_vercel_env "VITE_API_URL"           "${VITE_API_URL:-https://devonn-ai-backend.onrender.com}"
set_vercel_env "VITE_SUPABASE_URL"      "${VITE_SUPABASE_URL:-}"
set_vercel_env "VITE_SUPABASE_ANON_KEY" "${VITE_SUPABASE_ANON_KEY:-}"
set_vercel_env "VITE_SENTRY_DSN"        "${VITE_SENTRY_DSN:-}"
set_vercel_env "VITE_APP_ENV"           "production"

echo -e "${GREEN}✓ Environment variables synced to Vercel${NC}"

if [[ "${ENV_ONLY}" == "true" ]]; then
  echo ""
  echo -e "${GREEN}✓ Env-only mode complete. No deployment triggered.${NC}"
  exit 0
fi

# ── Trigger deployment ────────────────────────────────────────────────────────
echo -e "${YELLOW}[3/4] Triggering Vercel deployment...${NC}"

DEPLOY_TARGET="production"
[[ "${PREVIEW}" == "true" ]] && DEPLOY_TARGET="preview"

DEPLOY_RESPONSE=$(curl -s -X POST \
  "https://api.vercel.com/v13/deployments" \
  -H "Authorization: Bearer ${VERCEL_TOKEN}" \
  -H "Content-Type: application/json" \
  -d "{
    \"name\": \"supreme-ai-deployment-hub\",
    \"gitSource\": {
      \"type\": \"github\",
      \"repoId\": \"wesship/supreme-ai-deployment-hub\",
      \"ref\": \"main\"
    },
    \"target\": \"${DEPLOY_TARGET}\"
  }")

DEPLOY_URL=$(echo "${DEPLOY_RESPONSE}" | python3 -c "import json,sys; d=json.load(sys.stdin); print(d.get('url',''))" 2>/dev/null)
DEPLOY_ID=$(echo "${DEPLOY_RESPONSE}" | python3 -c "import json,sys; d=json.load(sys.stdin); print(d.get('id',''))" 2>/dev/null)

if [[ -n "${DEPLOY_URL}" ]]; then
  echo -e "${GREEN}✓ Deployment triggered!${NC}"
  echo "  URL: https://${DEPLOY_URL}"
  echo "  ID:  ${DEPLOY_ID}"
else
  echo -e "${YELLOW}⚠ Could not parse deployment URL. Check Vercel dashboard.${NC}"
  echo "  Response: ${DEPLOY_RESPONSE}" | head -200
fi

# ── Wait for deployment ───────────────────────────────────────────────────────
echo -e "${YELLOW}[4/4] Waiting for deployment to complete...${NC}"

if [[ -n "${DEPLOY_ID}" ]]; then
  for i in {1..30}; do
    sleep 10
    STATUS=$(curl -s \
      "https://api.vercel.com/v13/deployments/${DEPLOY_ID}" \
      -H "Authorization: Bearer ${VERCEL_TOKEN}" | \
      python3 -c "import json,sys; d=json.load(sys.stdin); print(d.get('readyState','UNKNOWN'))" 2>/dev/null)

    echo "  Status: ${STATUS} (${i}/30)"

    case "${STATUS}" in
      READY)
        echo -e "${GREEN}✓ Deployment is READY!${NC}"
        break
        ;;
      ERROR|CANCELED)
        echo -e "${RED}✗ Deployment ${STATUS}. Check Vercel dashboard.${NC}"
        exit 1
        ;;
    esac
  done
fi

echo ""
echo -e "${GREEN}═══════════════════════════════════════════════════════════${NC}"
echo -e "${GREEN}  ✓ Frontend deployment complete!${NC}"
echo -e "${GREEN}═══════════════════════════════════════════════════════════${NC}"
echo ""
echo "Next steps:"
echo "  1. Verify the live site is working"
echo "  2. Run smoke tests: ./scripts/smoke_test.sh"
echo "  3. Monitor Sentry for any runtime errors"
