#!/usr/bin/env bash
# Workflow inventory — list every workflow with triggers, jobs, schedule
# Safe / read-only. Output: reports/inventory.tsv
set -euo pipefail
cd "$(dirname "$0")/../.."
OUT="scripts/workflow-audit/reports/inventory.tsv"
echo -e "file\ttriggers\tjobs\tschedule\tpermissions\tsize_bytes" > "$OUT"
for f in .github/workflows/*.yml .github/workflows/*.yaml; do
  [[ -f "$f" ]] || continue
  name=$(basename "$f")
  triggers=$(awk '/^on:/{flag=1;next} /^[a-zA-Z]/{flag=0} flag' "$f" | grep -oE '^\s*[a-z_]+:' | tr -d ' :' | sort -u | paste -sd, -)
  jobs=$(awk '/^jobs:/{flag=1;next} /^[a-zA-Z]/{flag=0} flag && /^  [a-zA-Z]/' "$f" | grep -oE '^  [a-zA-Z0-9_-]+' | wc -l | tr -d ' ')
  cron=$(grep -E "cron:" "$f" 2>/dev/null | head -1 | sed 's/.*cron: *//' | tr -d "'\"" || echo "")
  perms=$(grep -E "^permissions:|write-all" "$f" 2>/dev/null | head -1 | tr -d "\n" || echo "")
  size=$(wc -c < "$f" | tr -d ' ')
  echo -e "${name}\t${triggers}\t${jobs}\t${cron}\t${perms}\t${size}" >> "$OUT"
done
echo "Wrote $OUT  ($(wc -l < "$OUT") rows)"
