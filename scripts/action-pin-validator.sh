#!/usr/bin/env bash
set -euo pipefail

WORKFLOW_DIR="${1:-.github/workflows}"

echo "=== GitHub Action Pin Validator ==="

matches=$(grep -RIn "uses: .*@[0-9a-f]\{40\}" "$WORKFLOW_DIR" || true)

if [[ -z "$matches" ]]; then
  echo "No SHA-pinned GitHub Actions detected."
  exit 0
fi

echo "$matches"

echo ""
echo "Review all SHA-pinned actions carefully:"
echo "- confirm upstream commit exists"
echo "- confirm action version still published"
echo "- confirm action has not been revoked"
echo "- replace stale pins with stable tags when appropriate"
