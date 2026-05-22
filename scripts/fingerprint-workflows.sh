#!/usr/bin/env bash
# Capture pre-lock fingerprints of every workflow for drift detection.
# Run BEFORE production-lock.sh. Output: governance/workflow-fingerprints.txt
set -euo pipefail
cd "$(dirname "$0")/.."
mkdir -p governance
OUT="governance/workflow-fingerprints.txt"
{
  echo "# Workflow Fingerprints — captured $(date -u +%Y-%m-%dT%H:%M:%SZ)"
  echo "# Any drift from these hashes after lock requires CHANGE_CONTROL approval."
  echo
  find .github/workflows -maxdepth 1 -type f \( -name "*.yml" -o -name "*.yaml" \) -print0 \
    | sort -z \
    | xargs -0 sha256sum
} > "$OUT"
echo "Wrote $OUT ($(grep -c "^[a-f0-9]" "$OUT") workflows fingerprinted)"
