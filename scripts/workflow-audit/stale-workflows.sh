#!/usr/bin/env bash
# Stale workflow detector — last commit age + last successful run age
# Requires: gh CLI. Output: reports/stale.tsv
set -euo pipefail
cd "$(dirname "$0")/../.."
OUT="scripts/workflow-audit/reports/stale.tsv"
echo -e "file\tlast_commit_days\tlast_run_status\tlast_run_days" > "$OUT"

NOW=$(date +%s)
for f in .github/workflows/*.yml .github/workflows/*.yaml; do
  [[ -f "$f" ]] || continue
  name=$(basename "$f")
  last_commit=$(git log -1 --format=%ct -- "$f" 2>/dev/null || echo 0)
  days_commit=$(( (NOW - last_commit) / 86400 ))

  if command -v gh >/dev/null 2>&1; then
    run=$(gh run list --workflow "$name" --limit 1 --json status,conclusion,createdAt 2>/dev/null \
          | jq -r '.[0] | "\(.conclusion // .status)\t\(.createdAt)"' 2>/dev/null || echo -e "none\t")
    status=$(echo "$run" | cut -f1)
    when=$(echo "$run" | cut -f2)
    if [[ -n "$when" && "$when" != "null" ]]; then
      ts=$(date -d "$when" +%s 2>/dev/null || echo 0)
      days_run=$(( (NOW - ts) / 86400 ))
    else
      days_run="—"
    fi
  else
    status="gh-missing"; days_run="—"
  fi

  echo -e "${name}\t${days_commit}\t${status}\t${days_run}" >> "$OUT"
done

echo "Wrote $OUT"
echo
echo "Top 20 stale (>90 days no run or never ran):"
awk -F'\t' 'NR>1 && ($4=="—" || $4+0 > 90)' "$OUT" | sort -t$'\t' -k4 -rn | head -20
