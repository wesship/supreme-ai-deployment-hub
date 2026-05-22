#!/usr/bin/env bash
# dead-paths.sh — Detect workflows that reference missing files, scripts,
# directories, Dockerfiles, or branches. Output: reports/dead-paths.tsv
set -euo pipefail

ROOT="$(git rev-parse --show-toplevel 2>/dev/null || pwd)"
WF_DIR="$ROOT/.github/workflows"
OUT_DIR="$ROOT/scripts/workflow-audit/reports"
OUT="$OUT_DIR/dead-paths.tsv"
mkdir -p "$OUT_DIR"

printf "workflow\tkind\treference\n" > "$OUT"

# Collect existing branches (local + remote) for branch validity checks
BRANCHES="$(git for-each-ref --format='%(refname:short)' refs/heads refs/remotes 2>/dev/null | sed 's|^origin/||' | sort -u || true)"

is_branch_valid() {
  local b="$1"
  # wildcards & expressions are always "valid" for our purposes
  case "$b" in
    *'*'*|*'!'*|*'$'*|*'{'*) return 0 ;;
  esac
  grep -qxF "$b" <<<"$BRANCHES"
}

shopt -s nullglob
for wf in "$WF_DIR"/*.yml "$WF_DIR"/*.yaml; do
  [ -f "$wf" ] || continue
  name="$(basename "$wf")"

  # 1. Referenced shell scripts: bash scripts/foo.sh   ./scripts/foo.sh   sh path/x.sh
  grep -Eo '(\./|\b)(scripts|bin|tools)/[A-Za-z0-9_./-]+\.(sh|py|js|ts|mjs)' "$wf" 2>/dev/null \
    | sort -u | while read -r ref; do
        rel="${ref#./}"
        [ -e "$ROOT/$rel" ] || printf "%s\tscript\t%s\n" "$name" "$rel" >> "$OUT"
      done

  # 2. Dockerfiles
  grep -Eo '[A-Za-z0-9_./-]*Dockerfile[A-Za-z0-9_.-]*' "$wf" 2>/dev/null \
    | sort -u | while read -r ref; do
        [ -e "$ROOT/$ref" ] || printf "%s\tdockerfile\t%s\n" "$name" "$ref" >> "$OUT"
      done

  # 3. working-directory: <path>
  grep -Eo 'working-directory:[[:space:]]*[A-Za-z0-9_./-]+' "$wf" 2>/dev/null \
    | awk -F: '{gsub(/^[ \t]+|[ \t]+$/,"",$2); print $2}' | sort -u | while read -r dir; do
        [ -z "$dir" ] && continue
        [ -d "$ROOT/$dir" ] || printf "%s\tworkdir\t%s\n" "$name" "$dir" >> "$OUT"
      done

  # 4. Branch refs under on: push/pull_request: branches:
  python3 - "$wf" "$name" "$OUT" <<'PY' 2>/dev/null || true
import sys, re, subprocess
wf, name, out = sys.argv[1], sys.argv[2], sys.argv[3]
try:
    import yaml
except ImportError:
    sys.exit(0)
try:
    data = yaml.safe_load(open(wf)) or {}
except Exception:
    sys.exit(0)
on = data.get(True, data.get("on", {}))
if not isinstance(on, dict): sys.exit(0)
branches = subprocess.run(
    ["git","for-each-ref","--format=%(refname:short)","refs/heads","refs/remotes"],
    capture_output=True, text=True
).stdout.splitlines()
branches = {b.removeprefix("origin/") for b in branches}
def check(blist):
    if not isinstance(blist, list): return
    for b in blist:
        if not isinstance(b, str): continue
        if any(c in b for c in "*!${"): continue
        if b not in branches:
            with open(out,"a") as f:
                f.write(f"{name}\tbranch\t{b}\n")
for trig in ("push","pull_request","pull_request_target"):
    t = on.get(trig)
    if isinstance(t, dict):
        check(t.get("branches", []))
        check(t.get("branches-ignore", []))
PY
done

count=$(($(wc -l < "$OUT") - 1))
echo "Dead path references: $count"
echo "Report: $OUT"
