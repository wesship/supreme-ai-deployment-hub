#!/usr/bin/env bash
# Run the full audit suite in safe order. Read-only. No mutations.
set -euo pipefail
HERE="$(cd "$(dirname "$0")" && pwd)"
echo "╔══════════════════════════════════════════════╗"
echo "║  DEVONN.AI  ·  Workflow Audit (read-only)    ║"
echo "╚══════════════════════════════════════════════╝"
bash "$HERE/inventory.sh"
echo
bash "$HERE/detect-duplicates.sh"
echo
bash "$HERE/workflow-risk-score.sh"
echo
if command -v gh >/dev/null 2>&1; then
  bash "$HERE/stale-workflows.sh"
else
  echo "[skip] stale-workflows.sh — gh CLI not available"
fi
echo
bash "$HERE/archive-candidates.sh"
echo
echo "── Reports written to scripts/workflow-audit/reports/ ──"
ls -la "$HERE/reports/"
