#!/usr/bin/env bash
# Generate archive-candidate list: stale + duplicate + zero-run workflows
# READ-ONLY. Output: reports/archive-candidates.md (review before any deletion)
set -euo pipefail
cd "$(dirname "$0")/../.."
OUT="scripts/workflow-audit/reports/archive-candidates.md"
R="scripts/workflow-audit/reports"

{
  echo "# Workflow Archive Candidates"
  echo "_Generated: $(date -u +%Y-%m-%dT%H:%M:%SZ)_"
  echo
  echo "**Review every entry before archiving. Do NOT delete pre-lock — only move to \`.github/workflows/archive/\` after \`v1.0-prod-lock\` is tagged.**"
  echo
  echo "## 1. Stale (>90 days since last run / never ran)"
  if [[ -f "$R/stale.tsv" ]]; then
    awk -F'\t' 'NR>1 && ($4=="—" || $4+0 > 90) {print "- `"$1"`  ·  last commit "$2"d ago  ·  last run: "$3" ("$4"d)"}' "$R/stale.tsv"
  else
    echo "_run stale-workflows.sh first_"
  fi
  echo
  echo "## 2. Duplicate signatures"
  if [[ -f "$R/duplicates.txt" ]]; then
    cat "$R/duplicates.txt"
  else
    echo "_run detect-duplicates.sh first_"
  fi
  echo
  echo "## 3. High-risk (score >= 5)"
  if [[ -f "$R/risk-score.tsv" ]]; then
    awk -F'\t' 'NR>1 && $2+0 >= 5 {print "- `"$1"`  ·  score "$2"  ·  "$7}' "$R/risk-score.tsv"
  else
    echo "_run workflow-risk-score.sh first_"
  fi
} > "$OUT"

echo "Wrote $OUT"
