#!/usr/bin/env bash
set -euo pipefail

WORKFLOW_DIR="${1:-.github/workflows}"

if [[ ! -d "$WORKFLOW_DIR" ]]; then
  echo "workflow directory not found: $WORKFLOW_DIR" >&2
  exit 1
fi

echo "=== DEVONN.AI Workflow Audit ==="

total=$(find "$WORKFLOW_DIR" -type f \( -name '*.yml' -o -name '*.yaml' \) | wc -l | tr -d ' ')
echo "Total workflows: $total"

echo ""
echo "=== Workflow Inventory ==="
find "$WORKFLOW_DIR" -type f \( -name '*.yml' -o -name '*.yaml' \) | sort

echo ""
echo "=== Potential Duplicate Workflow Names ==="
grep -R "^name:" "$WORKFLOW_DIR" | sed 's/^.*name:[ ]*//' | sort | uniq -d || true

echo ""
echo "=== Legacy Branch Triggers ==="
grep -RIn "branches: \[main, develop\]" "$WORKFLOW_DIR" || true

echo ""
echo "=== SHA Pinned Actions ==="
grep -RIn "uses: .*@[0-9a-f]\{40\}" "$WORKFLOW_DIR" || true

echo ""
echo "=== Azure-specific Workflows ==="
grep -RIl "azure" "$WORKFLOW_DIR" || true

echo ""
echo "=== Experimental / High-Cost Signals ==="
grep -RIlE "stryker|mutation|benchmark|load test|chaos" "$WORKFLOW_DIR" || true

echo ""
echo "=== Recommended Production Gate Candidates ==="
printf '%s
' \
  'CI - Hardened Build Pipeline' \
  'Devonn.AI Testing' \
  'CodeQL SAST' \
  'Secrets Elimination & Scanning' \
  'Final Green Check'

echo ""
echo "Workflow audit complete."
