#!/usr/bin/env bash
# DEVONN.AI — Final Production Lock Script
# Runs deterministic checks to verify the repo is production-ready.
# Exit non-zero on any failure so CI can gate releases on it.

set -euo pipefail

RED=$'\033[0;31m'; GREEN=$'\033[0;32m'; YELLOW=$'\033[1;33m'; NC=$'\033[0m'
FAIL=0
pass() { echo "${GREEN}✔${NC} $1"; }
fail() { echo "${RED}✘${NC} $1"; FAIL=1; }
warn() { echo "${YELLOW}!${NC} $1"; }

echo "── DEVONN.AI Production Lock ──────────────────────────────"

# 1. Required governance + meta files
REQUIRED_FILES=(
  "GOVERNANCE_LOCK_MANIFEST.md"
  ".github/workflows/governance-drift.yml"
  "README.md"
  "package.json"
  "supabase/config.toml"
)
for f in "${REQUIRED_FILES[@]}"; do
  [[ -f "$f" ]] && pass "exists: $f" || fail "missing: $f"
done

# 2. No tracked .env (Supabase auto-managed only)
if git ls-files --error-unmatch .env >/dev/null 2>&1; then
  fail ".env is tracked in git — untrack before release"
else
  pass ".env not tracked"
fi

# 3. No obvious hardcoded secrets
if grep -RInE 'AKIA[0-9A-Z]{16}|sk-[A-Za-z0-9]{20,}' \
     --include='*.{ts,tsx,js,jsx,py,yml,yaml,json}' \
     --exclude-dir=node_modules --exclude-dir=dist . 2>/dev/null | grep -v 'docs/PR107'; then
  fail "potential hardcoded secret detected"
else
  pass "no hardcoded AWS/OpenAI keys found"
fi

# 4. Privacy policy route present
if grep -q '/privacy-policy' src/App.tsx; then
  pass "/privacy-policy route registered"
else
  fail "/privacy-policy route missing in src/App.tsx"
fi

# 5. Typecheck script exists
if grep -q '"typecheck"' package.json; then
  pass "typecheck script present"
else
  warn "typecheck script not defined in package.json"
fi

# 6. Build (skip with SKIP_BUILD=1)
if [[ "${SKIP_BUILD:-0}" != "1" ]]; then
  if command -v bun >/dev/null; then
    bun run build >/dev/null && pass "build succeeded" || fail "build failed"
  else
    npm run build --silent >/dev/null && pass "build succeeded" || fail "build failed"
  fi
else
  warn "build skipped (SKIP_BUILD=1)"
fi

echo "───────────────────────────────────────────────────────────"
if [[ $FAIL -eq 0 ]]; then
  echo "${GREEN}PRODUCTION LOCK: PASS${NC}"
  exit 0
else
  echo "${RED}PRODUCTION LOCK: FAIL${NC}"
  exit 1
fi
