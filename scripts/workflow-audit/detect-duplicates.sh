#!/usr/bin/env bash
# Detect duplicate / near-duplicate workflows by job signature
# Safe / read-only. Output: reports/duplicates.txt
set -euo pipefail
cd "$(dirname "$0")/../.."
OUT="scripts/workflow-audit/reports/duplicates.txt"
TMP=$(mktemp -d)

for f in .github/workflows/*.yml .github/workflows/*.yaml; do
  [[ -f "$f" ]] || continue
  # signature = sorted unique action uses + run commands (normalized)
  {
    grep -oE 'uses:\s*[^[:space:]]+' "$f" | sort -u
    grep -oE 'run:\s*(npm|bun|yarn|pnpm|docker|terraform|gh) [a-z:_-]+' "$f" | sort -u
  } | sha256sum | awk '{print $1}' > "$TMP/$(basename "$f").sig"
done

{
  echo "── Duplicate / near-duplicate workflow signatures ──"
  echo
  for sig_file in "$TMP"/*.sig; do
    cat "$sig_file"
  done | sort | uniq -c | sort -rn | awk '$1 > 1 {print $0}' | while read -r count hash; do
    echo "Signature $hash matched $count workflows:"
    grep -l "$hash" "$TMP"/*.sig | while read -r m; do
      echo "  - $(basename "$m" .sig)"
    done
    echo
  done
} > "$OUT"

rm -rf "$TMP"
echo "Wrote $OUT"
cat "$OUT"
