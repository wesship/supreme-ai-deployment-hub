#!/usr/bin/env bash
# scripts/smoke-test.sh
#
# Phase 4 smoke test — verifies the live API is healthy and the auth gate
# is enforced on the proxy vault endpoint.
#
# Usage:
#   ./scripts/smoke-test.sh [API_BASE_URL]
#
# Examples:
#   ./scripts/smoke-test.sh                          # defaults to https://api.d3vonn.io
#   ./scripts/smoke-test.sh http://localhost:8000    # local dev
#
# Exit codes:
#   0 — all checks passed
#   1 — one or more checks failed
#
# Requirements: curl, jq (optional — degrades gracefully if absent)

set -euo pipefail

API="${1:-https://api.d3vonn.io}"
PASS=0
FAIL=0
WARN=0

# ── Colour helpers ────────────────────────────────────────────────────────────
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[0;33m'
RESET='\033[0m'

ok()   { echo -e "  ${GREEN}✓${RESET} $*"; ((PASS++)); }
fail() { echo -e "  ${RED}✗${RESET} $*"; ((FAIL++)); }
warn() { echo -e "  ${YELLOW}!${RESET} $*"; ((WARN++)); }

# ── HTTP helper ───────────────────────────────────────────────────────────────
http_status() {
  curl -s -o /dev/null -w "%{http_code}" --max-time 10 "$1" 2>/dev/null
}
http_body() {
  curl -s --max-time 10 "$1" 2>/dev/null
}
http_status_with_header() {
  # $1 = url, $2 = header name, $3 = header value
  curl -s -o /dev/null -w "%{http_code}" --max-time 10 \
    -H "$2: $3" "$1" 2>/dev/null
}

echo ""
echo "╔══════════════════════════════════════════════════════╗"
echo "║          Devonn.AI API Smoke Test — Phase 4          ║"
echo "╚══════════════════════════════════════════════════════╝"
echo "  Target: ${API}"
echo ""

# ── 1. Liveness ───────────────────────────────────────────────────────────────
echo "[ 1 ] Liveness — GET /health"
STATUS=$(http_status "${API}/health")
if [ "$STATUS" = "200" ]; then
  ok "GET /health → 200"
else
  fail "GET /health → ${STATUS} (expected 200)"
fi

# ── 2. Readiness ──────────────────────────────────────────────────────────────
echo "[ 2 ] Readiness — GET /ready"
STATUS=$(http_status "${API}/ready")
if [ "$STATUS" = "200" ]; then
  ok "GET /ready → 200"
else
  fail "GET /ready → ${STATUS} (expected 200)"
fi

# ── 3. Deep health with proxy_vault block ────────────────────────────────────
echo "[ 3 ] Deep health — GET /health/deep"
BODY=$(http_body "${API}/health/deep")
STATUS=$(echo "$BODY" | grep -o '"status":"ok"' | wc -l | tr -d ' ')
if [ "$STATUS" -ge "1" ]; then
  ok "GET /health/deep → status:ok"
else
  fail "GET /health/deep → unexpected body: ${BODY:0:120}"
fi

# Check proxy_vault block is present
if echo "$BODY" | grep -q '"proxy_vault"'; then
  ok "GET /health/deep → proxy_vault block present"
else
  warn "GET /health/deep → proxy_vault block missing (deploy may be pending)"
fi

# ── 4. Auth gate on proxy config ─────────────────────────────────────────────
echo "[ 4 ] Auth gate — GET /api/proxy/config (no token)"
STATUS=$(http_status "${API}/api/proxy/config")
if [ "$STATUS" = "401" ]; then
  ok "GET /api/proxy/config (no token) → 401 Unauthorized"
elif [ "$STATUS" = "404" ]; then
  fail "GET /api/proxy/config → 404 (router not registered — deploy pending)"
else
  fail "GET /api/proxy/config → ${STATUS} (expected 401)"
fi

# ── 5. Auth gate on vault keys ────────────────────────────────────────────────
echo "[ 5 ] Auth gate — GET /api/proxy/vault/keys (no token)"
STATUS=$(http_status "${API}/api/proxy/vault/keys")
if [ "$STATUS" = "401" ]; then
  ok "GET /api/proxy/vault/keys (no token) → 401 Unauthorized"
elif [ "$STATUS" = "404" ]; then
  fail "GET /api/proxy/vault/keys → 404 (router not registered — deploy pending)"
else
  fail "GET /api/proxy/vault/keys → ${STATUS} (expected 401)"
fi

# ── 6. Auth gate on vault POST ────────────────────────────────────────────────
echo "[ 6 ] Auth gate — POST /api/proxy/vault/keys (no token)"
STATUS=$(curl -s -o /dev/null -w "%{http_code}" --max-time 10 \
  -X POST -H "Content-Type: application/json" \
  -d '{"name":"FAKE_KEY","value":"sk-fake"}' \
  "${API}/api/proxy/vault/keys" 2>/dev/null)
if [ "$STATUS" = "401" ]; then
  ok "POST /api/proxy/vault/keys (no token) → 401 Unauthorized"
elif [ "$STATUS" = "404" ]; then
  fail "POST /api/proxy/vault/keys → 404 (router not registered — deploy pending)"
else
  fail "POST /api/proxy/vault/keys → ${STATUS} (expected 401)"
fi

# ── 7. OpenAPI spec sanity ────────────────────────────────────────────────────
echo "[ 7 ] OpenAPI spec — GET /api/openapi.json"
BODY=$(http_body "${API}/api/openapi.json")
PROXY_ROUTES=$(echo "$BODY" | grep -o '"/api/proxy' | wc -l | tr -d ' ')
if [ "$PROXY_ROUTES" -ge "3" ]; then
  ok "OpenAPI spec contains ${PROXY_ROUTES} /api/proxy routes"
elif [ "$PROXY_ROUTES" -ge "1" ]; then
  warn "OpenAPI spec contains only ${PROXY_ROUTES} /api/proxy routes (expected ≥3)"
else
  fail "OpenAPI spec contains no /api/proxy routes (deploy pending or router missing)"
fi

# ── Summary ───────────────────────────────────────────────────────────────────
echo ""
echo "──────────────────────────────────────────────────────"
echo -e "  ${GREEN}Passed:${RESET}  ${PASS}"
echo -e "  ${YELLOW}Warnings:${RESET} ${WARN}"
echo -e "  ${RED}Failed:${RESET}  ${FAIL}"
echo "──────────────────────────────────────────────────────"
echo ""

if [ "$FAIL" -gt 0 ]; then
  echo -e "${RED}SMOKE TEST FAILED — ${FAIL} check(s) did not pass.${RESET}"
  exit 1
else
  echo -e "${GREEN}SMOKE TEST PASSED${RESET}"
  exit 0
fi
