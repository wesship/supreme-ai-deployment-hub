#!/usr/bin/env bash
# Permission & secret risk scoring per workflow
# Safe / read-only. Output: reports/risk-score.tsv
set -euo pipefail
cd "$(dirname "$0")/../.."
OUT="scripts/workflow-audit/reports/risk-score.tsv"
echo -e "file\tscore\twrite_all\tpull_request_target\tworkflow_run\tsecrets_used\tnotes" > "$OUT"

for f in .github/workflows/*.yml .github/workflows/*.yaml; do
  [[ -f "$f" ]] || continue
  name=$(basename "$f")
  score=0; notes=""

  write_all=0
  if grep -qE "write-all|contents:\s*write|packages:\s*write|id-token:\s*write" "$f"; then
    write_all=1; score=$((score+3)); notes="$notes broad-perms;"
  fi

  prt=0
  if grep -qE "^on:.*pull_request_target|pull_request_target:" "$f"; then
    prt=1; score=$((score+4)); notes="$notes pr-target;"
  fi

  wfrun=0
  if grep -qE "workflow_run:" "$f"; then
    wfrun=1; score=$((score+2)); notes="$notes workflow_run;"
  fi

  secrets=$(grep -oE 'secrets\.[A-Z0-9_]+' "$f" | sort -u | wc -l | tr -d ' ')
  if [[ "$secrets" -gt 3 ]]; then score=$((score+1)); notes="$notes many-secrets;"; fi

  if grep -qE 'shell:\s*bash' "$f" && grep -qE '\$\{\{\s*github\.event\.' "$f"; then
    score=$((score+3)); notes="$notes event-injection-risk;"
  fi

  echo -e "${name}\t${score}\t${write_all}\t${prt}\t${wfrun}\t${secrets}\t${notes}" >> "$OUT"
done

echo "Wrote $OUT"
echo
echo "Top 15 highest-risk workflows:"
(head -1 "$OUT"; tail -n +2 "$OUT" | sort -t$'\t' -k2 -rn | head -15) | column -t -s$'\t'
