#!/usr/bin/env bash
# Workflow inventory — deterministic metadata-only workflow audit.
# Safe / read-only. Output: scripts/workflow-audit/reports/inventory.tsv
set -euo pipefail

cd "$(dirname "$0")/../.."
OUT="scripts/workflow-audit/reports/inventory.tsv"
MODE="${1:-write}"
TMP="$(mktemp)"
trap 'rm -f "$TMP"' EXIT

sanitize() {
  tr '\t\n' '  ' | sed -E 's/[[:space:]]+/ /g; s/^ //; s/ $//'
}

csv_unique() {
  sed '/^$/d' | sort -u | paste -sd, -
}

printf '%s\n' 'file	workflow_name	triggers	job_ids	job_names	schedule	concurrency	environments	permissions	artifacts	retention_days	reusable_workflows	secret_names	mutation_risk	size_bytes' > "$TMP"

for f in .github/workflows/*.yml .github/workflows/*.yaml; do
  [[ -f "$f" ]] || continue

  file=$(basename "$f")
  workflow_name=$(awk -F': *' '/^name:/{sub(/^name:[[:space:]]*/, ""); gsub(/^['\"']|['\"']$/, ""); print; exit}' "$f" | sanitize)
  triggers=$(awk '/^on:/{flag=1;next} /^[^[:space:]]/{flag=0} flag' "$f" \
    | grep -oE '^[[:space:]]{2}[a-zA-Z_][a-zA-Z0-9_-]*:' \
    | tr -d ' :' | csv_unique || true)
  job_ids=$(awk '/^jobs:/{flag=1;next} /^[^[:space:]]/{flag=0} flag && /^  [a-zA-Z0-9_-]+:/{gsub(/^  |:.*/, ""); print}' "$f" | csv_unique || true)
  job_names=$(awk '/^jobs:/{flag=1;next} /^[^[:space:]]/{flag=0} flag && /^    name:/{sub(/^    name:[[:space:]]*/, ""); gsub(/^['\"']|['\"']$/, ""); print}' "$f" | csv_unique || true)
  schedules=$(grep -E 'cron:' "$f" 2>/dev/null | sed -E "s/.*cron:[[:space:]]*['\"]?//; s/['\"]?[[:space:]]*(#.*)?$//" | csv_unique || true)
  concurrency=$(awk '/^concurrency:/{flag=1;next} /^[^[:space:]]/{flag=0} flag && /group:/{sub(/^.*group:[[:space:]]*/, ""); print}' "$f" | csv_unique || true)
  environments=$(grep -E '^[[:space:]]+environment:' "$f" 2>/dev/null | sed -E 's/^.*environment:[[:space:]]*//' | tr -d "'\"" | csv_unique || true)
  permissions=$(awk '/^permissions:/{flag=1; print; next} /^[^[:space:]]/{flag=0} flag' "$f" | sanitize)
  artifacts=$(grep -B8 -A8 'actions/upload-artifact@' "$f" 2>/dev/null | grep -E '^[[:space:]]+name:' | sed -E 's/^.*name:[[:space:]]*//' | tr -d "'\"" | csv_unique || true)
  retention=$(grep -E 'retention-days:' "$f" 2>/dev/null | sed -E 's/^.*retention-days:[[:space:]]*//' | tr -d "'\"" | csv_unique || true)
  reusable=$(grep -E '^[[:space:]]+uses:[[:space:]]+[^ ]+\.ya?ml(@|$)' "$f" 2>/dev/null | sed -E 's/^.*uses:[[:space:]]*//' | csv_unique || true)
  secret_names=$(grep -oE 'secrets\.[A-Z0-9_]+' "$f" 2>/dev/null | sed 's/^secrets\.//' | csv_unique || true)
  size=$(wc -c < "$f" | tr -d ' ')

  mutation_risk="read-only"
  if grep -Eq 'permissions:[[:space:]]*write-all|contents:[[:space:]]*write|pull-requests:[[:space:]]*write|issues:[[:space:]]*write|deployments:[[:space:]]*write|packages:[[:space:]]*write|id-token:[[:space:]]*write' "$f"; then
    mutation_risk="write-capable"
  fi
  if grep -Eq 'kubectl apply|terraform apply|supabase db push|railway up|vercel deploy|gh pr merge|gh issue create|git push|npm publish|docker push' "$f"; then
    mutation_risk="deployment-or-mutation"
  fi

  printf '%s\t%s\t%s\t%s\t%s\t%s\t%s\t%s\t%s\t%s\t%s\t%s\t%s\t%s\t%s\n' \
    "$file" "$workflow_name" "$triggers" "$job_ids" "$job_names" "$schedules" "$concurrency" \
    "$environments" "$permissions" "$artifacts" "$retention" "$reusable" "$secret_names" "$mutation_risk" "$size" >> "$TMP"
done

case "$MODE" in
  write)
    mkdir -p "$(dirname "$OUT")"
    mv "$TMP" "$OUT"
    trap - EXIT
    echo "Wrote $OUT ($(wc -l < "$OUT") rows)"
    ;;
  --check|check)
    if [[ ! -f "$OUT" ]]; then
      echo "ERROR: $OUT is missing. Run $0 write." >&2
      exit 1
    fi
    if ! diff -u "$OUT" "$TMP"; then
      echo "ERROR: workflow inventory is stale. Run $0 write and commit the result." >&2
      exit 1
    fi
    echo "Workflow inventory is current."
    ;;
  *)
    echo "Usage: $0 [write|--check]" >&2
    exit 2
    ;;
esac
