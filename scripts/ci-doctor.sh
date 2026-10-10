#!/usr/bin/env bash
set -euo pipefail

WORKFLOW_DIR="${1:-.github/workflows}"

if [[ ! -d "$WORKFLOW_DIR" ]]; then
  echo "CI Doctor: workflow directory not found: $WORKFLOW_DIR" >&2
  exit 2
fi

# These immutable commits are verified action releases used by the repository.
# Keep this allowlist explicit so a malformed or fabricated pin fails locally and
# in CI, rather than making every SHA-pinned action look like a failure.
readonly SETUP_NODE_PINS=(
  "49933ea5288caeca8642d1e84afbd3f7d6820020" # actions/setup-node v4.4.0
)
readonly SETUP_PYTHON_PINS=(
  "a26af69be951a213d495a4c3e4e4022e16d87065" # actions/setup-python v5.6.0
  "0b93645e9fea7318ecaed2b359559ac225c90a2b" # actions/setup-python v5.4.0
)

contains_pin() {
  local candidate="$1"
  shift
  local expected
  for expected in "$@"; do
    [[ "$candidate" == "$expected" ]] && return 0
  done
  return 1
}

failures=0
check_setup_action_pins() {
  local action="$1"
  shift
  local references
  references=$(grep -RInE "uses:[[:space:]]*${action}@[0-9a-f]{40}" \
    --include='*.yml' --include='*.yaml' "$WORKFLOW_DIR" || true)

  [[ -z "$references" ]] && return

  while IFS= read -r reference; do
    [[ -z "$reference" ]] && continue
    local pin
    pin=$(printf '%s\n' "$reference" | sed -nE "s#.*${action}@([0-9a-f]{40}).*#\\1#p")
    if ! contains_pin "$pin" "$@"; then
      echo "[UNVERIFIED_${action//\//_}_PIN]"
      echo "$reference"
      failures=$((failures + 1))
    fi
  done <<< "$references"
}

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

echo "CI Doctor: scanning $WORKFLOW_DIR"

# Known bad historical pin that makes GitHub Actions fail during setup.
check_pattern "actions/setup-node@49933ea5288caeca82d0b6d5f7e6e8f2b4f5c6a8" "BROKEN_SETUP_NODE_PIN"
check_setup_action_pins "actions/setup-node" "${SETUP_NODE_PINS[@]}"
check_setup_action_pins "actions/setup-python" "${SETUP_PYTHON_PINS[@]}"

# Flag legacy multi-branch gates that still target develop when the repository standard is main/staging.
check_pattern "branches: \[main, develop\]" "LEGACY_DEVELOP_BRANCH_TRIGGER"

if [[ "$failures" -gt 0 ]]; then
  echo ""
  echo "CI Doctor found $failures workflow drift item(s)."
  echo "Fix the flagged workflows before requiring them for branch protection."
  exit 1
fi

echo "CI Doctor passed: all monitored action pins and workflow triggers are valid."
