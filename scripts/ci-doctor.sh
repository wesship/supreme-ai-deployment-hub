#!/usr/bin/env bash
set -euo pipefail

WORKFLOW_DIR="${1:-.github/workflows}"

if [[ ! -d "$WORKFLOW_DIR" ]]; then
  echo "CI Doctor: workflow directory not found: $WORKFLOW_DIR" >&2
  exit 2
fi

echo "CI Doctor: scanning $WORKFLOW_DIR"

failures=0

check_pattern() {
  local pattern="$1"
  local label="$2"
  local matches
  matches=$(grep -RIn --include='*.yml' --include='*.yaml' "$pattern" "$WORKFLOW_DIR" || true)
  if [[ -n "$matches" ]]; then
    echo ""
    echo "[$label]"
    echo "$matches"
    failures=$((failures + 1))
  fi
}

# Known bad historical pin that makes GitHub Actions fail during setup.
check_pattern "actions/setup-node@49933ea5288caeca82d0b6d5f7e6e8f2b4f5c6a8" "BROKEN_SETUP_NODE_PIN"

# Broad detector for SHA-pinned setup-node references. These are allowed only when verified.
check_pattern "actions/setup-node@[0-9a-f]\{40\}" "REVIEW_SETUP_NODE_SHA_PIN"

# Broad detector for SHA-pinned setup-python references. These are allowed only when verified.
check_pattern "actions/setup-python@[0-9a-f]\{40\}" "REVIEW_SETUP_PYTHON_SHA_PIN"

# Flag legacy multi-branch gates that still target develop when the repo standard is main/staging.
check_pattern "branches: \[main, develop\]" "LEGACY_DEVELOP_BRANCH_TRIGGER"

if [[ "$failures" -gt 0 ]]; then
  echo ""
  echo "CI Doctor found $failures workflow drift category/categories."
  echo "Fix the flagged workflows before requiring them for branch protection."
  exit 1
fi

echo "CI Doctor passed: no known workflow drift patterns found."
