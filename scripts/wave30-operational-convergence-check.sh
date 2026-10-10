#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

FAILURES=0

check_path() {
  local path="$1"
  if [ ! -e "$path" ]; then
    echo "[FAIL] missing required path: $path"
    FAILURES=$((FAILURES + 1))
  else
    echo "[OK] $path"
  fi
}

check_file() {
  local file="$1"
  if [ ! -f "$file" ]; then
    echo "[FAIL] missing required file: $file"
    FAILURES=$((FAILURES + 1))
  else
    echo "[OK] $file"
  fi
}

echo "=== DEVONN.AI WAVE 30 CONVERGENCE CHECK ==="

check_path ".github/workflows"
check_path "docs"
check_path "scripts"
check_path "governance"

check_file "package.json"
check_file "docs/WAVE_30_OPERATIONAL_CONVERGENCE.md"

if compgen -G ".github/workflows/*.yml" > /dev/null; then
  WORKFLOW_COUNT=$(find .github/workflows -name "*.yml" | wc -l | tr -d ' ')
  echo "[INFO] workflow count: $WORKFLOW_COUNT"
else
  echo "[FAIL] no workflows detected"
  FAILURES=$((FAILURES + 1))
fi

if grep -R --exclude-dir=node_modules --exclude-dir=.git -n "sk_live_\|ghp_\|github_pat_" . >/dev/null 2>&1; then
  echo "[WARN] possible hardcoded secret markers detected"
else
  echo "[OK] no obvious hardcoded token markers detected"
fi

if [ "$FAILURES" -gt 0 ]; then
  echo "=== CONVERGENCE CHECK FAILED ($FAILURES failures) ==="
  exit 1
fi

echo "=== CONVERGENCE CHECK PASSED ==="
