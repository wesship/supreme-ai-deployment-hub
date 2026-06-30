#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────────────────────
# scripts/smoke_test.sh
# Devonn.AI — Post-Deployment Smoke Test
#
# Validates that all critical endpoints are live and responding correctly.
#
# Usage:
#   ./scripts/smoke_test.sh                                    # Test production
#   ./scripts/smoke_test.sh --backend http://localhost:8000    # Test local
#   ./scripts/smoke_test.sh --frontend https://my-preview.vercel.app
#
# Exit codes:
#   0 = All tests passed
#   1 = One or more tests failed
# ─────────────────────────────────────────────────────────────────────────────

set -euo pipefail

RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'; BLUE='\033[0;34m'; NC='\033[0m'

BACKEND_URL="${BACKEND_URL:-https://d3vonn-backend.onrender.com}"
FRONTEND_URL="${FRONTEND_URL:-https://d3vonn.io}"
FAIL_COUNT=0
PASS_COUNT=0

for arg in "$@"; do
  case $arg in
    --backend=*)  BACKEND_URL="${arg#*=}" ;;
    --frontend=*) FRONTEND_URL="${arg#*=}" ;;
  esac
done

echo -e "${BLUE}═══════════════════════════════════════════════════════════${NC}"
echo -e "${BLUE}  Devonn.AI — Smoke Tests${NC}"
echo -e "${BLUE}  Backend:  ${BACKEND_URL}${NC}"
echo -e "${BLUE}  Frontend: ${FRONTEND_URL}${NC}"
echo -e "${BLUE}═══════════════════════════════════════════════════════════${NC}"
echo ""

# ── Test helper ───────────────────────────────────────────────────────────────
check() {
  local NAME="$1"
  local URL="$2"
  local EXPECTED_STATUS="${3:-200}"
  local EXPECTED_BODY="${4:-}"

  RESPONSE=$(curl -s -o /tmp/smoke_body -w "%{http_code}" --max-time 15 "${URL}" 2>/dev/null || echo "000")
  BODY=$(cat /tmp/smoke_body 2>/dev/null || echo "")

  if [[ "${RESPONSE}" == "${EXPECTED_STATUS}" ]]; then
    if [[ -n "${EXPECTED_BODY}" ]] && ! echo "${BODY}" | grep -q "${EXPECTED_BODY}"; then
      echo -e "  ${RED}✗ FAIL ${NAME}${NC}"
      echo -e "    URL: ${URL}"
      echo -e "    Expected body to contain: ${EXPECTED_BODY}"
      echo -e "    Got: ${BODY:0:200}"
      FAIL_COUNT=$((FAIL_COUNT + 1))
    else
      echo -e "  ${GREEN}✓ PASS ${NAME}${NC} (HTTP ${RESPONSE})"
      PASS_COUNT=$((PASS_COUNT + 1))
    fi
  else
    echo -e "  ${RED}✗ FAIL ${NAME}${NC}"
    echo -e "    URL: ${URL}"
    echo -e "    Expected HTTP ${EXPECTED_STATUS}, got ${RESPONSE}"
    FAIL_COUNT=$((FAIL_COUNT + 1))
  fi
}

# ── Backend smoke tests ───────────────────────────────────────────────────────
echo -e "${YELLOW}Backend Tests (${BACKEND_URL})${NC}"
check "Health endpoint"         "${BACKEND_URL}/health"             "200" "ok"
check "API v1 root"             "${BACKEND_URL}/api/v1/"            "200"
check "API v2 root"             "${BACKEND_URL}/api/v2/"            "200"
check "OpenAPI spec"            "${BACKEND_URL}/openapi.json"       "200" "openapi"
check "Agents list (no auth)"   "${BACKEND_URL}/api/v1/agents"      "401"
check "Feature flags (no auth)" "${BACKEND_URL}/api/v1/flags"       "401"
echo ""

# ── Frontend smoke tests ──────────────────────────────────────────────────────
echo -e "${YELLOW}Frontend Tests (${FRONTEND_URL})${NC}"
check "Homepage loads"          "${FRONTEND_URL}/"                  "200" "Devonn"
check "Agents page"             "${FRONTEND_URL}/agents"            "200"
check "Settings page"           "${FRONTEND_URL}/settings"          "200"
check "Static assets"           "${FRONTEND_URL}/favicon.ico"       "200"
echo ""

# ── Security header tests ─────────────────────────────────────────────────────
echo -e "${YELLOW}Security Header Tests${NC}"

check_header() {
  local NAME="$1"
  local URL="$2"
  local HEADER="$3"
  local EXPECTED="$4"

  VALUE=$(curl -s -I --max-time 10 "${URL}" 2>/dev/null | grep -i "^${HEADER}:" | tr -d '\r' | cut -d':' -f2- | xargs || echo "")

  if echo "${VALUE}" | grep -qi "${EXPECTED}"; then
    echo -e "  ${GREEN}✓ PASS ${NAME}${NC}: ${VALUE}"
    PASS_COUNT=$((PASS_COUNT + 1))
  else
    echo -e "  ${YELLOW}⚠ WARN ${NAME}${NC}: expected '${EXPECTED}', got '${VALUE:-<missing>}'"
    # Not a hard failure — headers may be set by CDN
  fi
}

check_header "X-Frame-Options"       "${FRONTEND_URL}/" "X-Frame-Options"       "DENY"
check_header "X-Content-Type-Options" "${FRONTEND_URL}/" "X-Content-Type-Options" "nosniff"
check_header "Referrer-Policy"       "${FRONTEND_URL}/" "Referrer-Policy"       "strict-origin"
echo ""

# ── Summary ───────────────────────────────────────────────────────────────────
echo -e "${BLUE}═══════════════════════════════════════════════════════════${NC}"
if [[ "${FAIL_COUNT}" -eq 0 ]]; then
  echo -e "${GREEN}  ✓ All ${PASS_COUNT} smoke tests PASSED${NC}"
  echo -e "${BLUE}═══════════════════════════════════════════════════════════${NC}"
  exit 0
else
  echo -e "${RED}  ✗ ${FAIL_COUNT} test(s) FAILED, ${PASS_COUNT} passed${NC}"
  echo -e "${BLUE}═══════════════════════════════════════════════════════════${NC}"
  exit 1
fi
