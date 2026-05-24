#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

FAILURES=0

required_docs=(
  "docs/WAVE_33_AUTONOMOUS_RUNTIME_STABILIZATION.md"
  "docs/RUNTIME_EXECUTION_LIFECYCLE.md"
)

for file in "${required_docs[@]}"; do
  if [ ! -f "$file" ]; then
    echo "[FAIL] missing runtime governance document: $file"
    FAILURES=$((FAILURES + 1))
  else
    echo "[OK] $file"
  fi
done

required_states=(
  "PENDING"
  "LOCKED"
  "RUNNING"
  "RETRY"
  "PAUSED"
  "MANUAL_REVIEW"
  "ESCALATED"
  "FAILED"
  "COMPLETED"
  "STALE"
)

for state in "${required_states[@]}"; do
  if ! grep -R "$state" docs/RUNTIME_EXECUTION_LIFECYCLE.md >/dev/null 2>&1; then
    echo "[FAIL] missing lifecycle state: $state"
    FAILURES=$((FAILURES + 1))
  else
    echo "[OK] lifecycle state present: $state"
  fi
done

if [ "$FAILURES" -gt 0 ]; then
  echo "=== RUNTIME LIFECYCLE GUARD FAILED ($FAILURES failures) ==="
  exit 1
fi

echo "=== RUNTIME LIFECYCLE GUARD PASSED ==="
