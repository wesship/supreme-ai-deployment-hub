#!/usr/bin/env bash
set -euo pipefail

WORKFLOW_DIR="${1:-.github/workflows}"

if [[ ! -d "$WORKFLOW_DIR" ]]; then
  echo "workflow directory not found: $WORKFLOW_DIR" >&2
  exit 1
fi

echo "=== DEVONN.AI Workflow Classifier ==="

echo ""
echo "| Workflow | Classification | Reason |"
echo "|---|---|---|"

while IFS= read -r file; do
  name=$(grep -m1 '^name:' "$file" | sed 's/^name:[ ]*//' | tr -d '"' || true)
  [[ -z "$name" ]] && name=$(basename "$file")

  classification="staging"
  reason="general workflow; review before making required"

  lower=$(printf '%s %s' "$file" "$name" | tr '[:upper:]' '[:lower:]')
  content=$(tr '[:upper:]' '[:lower:]' < "$file")

  if [[ "$lower" == *"codeql"* || "$lower" == *"secret"* || "$lower" == *"security"* || "$lower" == *"final green"* || "$lower" == *"commit lint"* || "$lower" == *"hermes"* ]]; then
    classification="production-candidate"
    reason="security/governance/final validation signal"
  fi

  if [[ "$content" == *"schedule:"* || "$lower" == *"mutation"* || "$lower" == *"benchmark"* || "$lower" == *"chaos"* || "$lower" == *"load"* ]]; then
    classification="scheduled-or-advisory"
    reason="high-cost, periodic, or non-blocking validation"
  fi

  if [[ "$lower" == *"azure"* || "$lower" == *"render"* || "$lower" == *"vercel"* || "$lower" == *"deploy"* ]]; then
    classification="environment-bound"
    reason="depends on provider secrets or deployment environment"
  fi

  if [[ "$content" == *"develop"* || "$lower" == *"legacy"* || "$lower" == *"old"* || "$lower" == *"deprecated"* ]]; then
    classification="archive-review"
    reason="legacy trigger/name detected"
  fi

  printf '| `%s` | `%s` | %s |\n' "$file" "$classification" "$reason"
done < <(find "$WORKFLOW_DIR" -type f \( -name '*.yml' -o -name '*.yaml' \) | sort)

echo ""
echo "Recommended rule: only production-candidate workflows should be considered for required branch protection checks."
