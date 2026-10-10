#!/usr/bin/env bash
# Detect TRUE duplicates: workflows whose normalized YAML body (minus name,
# whitespace, comments) is byte-identical or >85% similar.
#
# Old version clustered by `uses:` action set, which incorrectly flagged
# 17 workflows that merely share scaffolding (checkout + setup-python +
# upload-artifact) as "duplicates" — but their job logic is unique.
#
# Read-only. Output: reports/duplicates.txt + reports/near-duplicates.tsv

set -uo pipefail
cd "$(dirname "$0")/../.."
OUT="scripts/workflow-audit/reports/duplicates.txt"
NEAR="scripts/workflow-audit/reports/near-duplicates.tsv"
TMP=$(mktemp -d)

# Normalize each workflow: strip comments, strip `name:` line, collapse
# whitespace, hash. Files with identical hash = true duplicates.
for f in .github/workflows/*.yml .github/workflows/*.yaml; do
  [[ -f "$f" ]] || continue
  base=$(basename "$f")
  sed -E -e 's/#.*$//' -e '/^name:/d' -e 's/[[:space:]]+/ /g' "$f" \
    | grep -v '^[[:space:]]*$' \
    > "$TMP/$base.norm"
  sha256sum "$TMP/$base.norm" | awk '{print $1}' > "$TMP/$base.sig"
done

{
  echo "── TRUE Duplicate Workflows (byte-identical after normalization) ──"
  echo
  declare -A seen
  any=0
  for sig_file in "$TMP"/*.sig; do
    hash=$(cat "$sig_file")
    if [[ -n "${seen[$hash]:-}" ]]; then
      seen[$hash]="${seen[$hash]} $(basename "$sig_file" .sig)"
    else
      seen[$hash]="$(basename "$sig_file" .sig)"
    fi
  done
  for h in "${!seen[@]}"; do
    files=(${seen[$h]})
    if [[ ${#files[@]} -gt 1 ]]; then
      any=1
      echo "[$h]"
      for x in "${files[@]}"; do echo "  - $x"; done
      echo
    fi
  done
  [[ $any -eq 0 ]] && echo "(none — no byte-identical workflows found)"
} > "$OUT"

# Near-duplicate scan: line-count diff < 20% AND >70% line overlap
{
  echo -e "file_a\tfile_b\tlines_a\tlines_b\tshared_lines\tsimilarity_pct"
  files=("$TMP"/*.norm)
  for ((i=0; i<${#files[@]}; i++)); do
    for ((j=i+1; j<${#files[@]}; j++)); do
      a="${files[$i]}"; b="${files[$j]}"
      la=$(wc -l < "$a"); lb=$(wc -l < "$b")
      [[ $la -lt 10 || $lb -lt 10 ]] && continue
      ratio=$(( la > lb ? la*100/lb : lb*100/la ))
      [[ $ratio -gt 120 ]] && continue
      shared=$(comm -12 <(sort -u "$a") <(sort -u "$b") | wc -l)
      smaller=$(( la < lb ? la : lb ))
      sim=$(( shared * 100 / smaller ))
      if [[ $sim -ge 70 ]]; then
        echo -e "$(basename "$a" .norm)\t$(basename "$b" .norm)\t$la\t$lb\t$shared\t$sim"
      fi
    done
  done
} > "$NEAR"

rm -rf "$TMP"
echo "Wrote $OUT"
echo "Wrote $NEAR"
echo
echo "─ True duplicates ─"
cat "$OUT" | tail -n +3
echo
echo "─ Near-duplicates (>=70% line overlap) ─"
head -20 "$NEAR" | column -t -s$'\t'
