#!/usr/bin/env bash
# permissions-audit.sh — Audit workflow permissions & secret usage.
# Flags: write-all, id-token: write, contents: write at top-level,
# missing top-level `permissions:` block, and secret reference counts.
# Output: reports/permissions-audit.tsv
set -euo pipefail

ROOT="$(git rev-parse --show-toplevel 2>/dev/null || pwd)"
WF_DIR="$ROOT/.github/workflows"
OUT_DIR="$ROOT/scripts/workflow-audit/reports"
OUT="$OUT_DIR/permissions-audit.tsv"
mkdir -p "$OUT_DIR"

printf "workflow\thas_top_perms\twrite_all\tid_token_write\tcontents_write\tactions_write\tpackages_write\tsecret_refs\tsecret_names\tflags\n" > "$OUT"

shopt -s nullglob
for wf in "$WF_DIR"/*.yml "$WF_DIR"/*.yaml; do
  [ -f "$wf" ] || continue
  name="$(basename "$wf")"

  python3 - "$wf" "$name" "$OUT" <<'PY' 2>/dev/null || true
import sys, re
wf, name, out = sys.argv[1], sys.argv[2], sys.argv[3]
try:
    import yaml
except ImportError:
    sys.exit(0)
try:
    raw = open(wf).read()
    data = yaml.safe_load(raw) or {}
except Exception:
    sys.exit(0)

has_top = "permissions" in data
perms = data.get("permissions", {})
write_all = perms == "write-all" or perms == "write"
id_token = contents = actions = packages = False
if isinstance(perms, dict):
    id_token = perms.get("id-token") == "write"
    contents = perms.get("contents") == "write"
    actions  = perms.get("actions")  == "write"
    packages = perms.get("packages") == "write"

# also scan job-level permissions for elevated scopes
for job in (data.get("jobs") or {}).values():
    if not isinstance(job, dict): continue
    jp = job.get("permissions")
    if jp == "write-all" or jp == "write": write_all = True
    if isinstance(jp, dict):
        id_token = id_token or jp.get("id-token") == "write"
        contents = contents or jp.get("contents") == "write"
        actions  = actions  or jp.get("actions")  == "write"
        packages = packages or jp.get("packages") == "write"

secret_names = sorted(set(re.findall(r"secrets\.([A-Z0-9_]+)", raw)))
n = len(secret_names)

flags = []
if not has_top: flags.append("NO_TOP_PERMS")
if write_all:   flags.append("WRITE_ALL")
if id_token and contents: flags.append("DEPLOY_CAPABLE")
if n >= 5: flags.append("SECRET_HEAVY")

with open(out, "a") as f:
    f.write("\t".join([
        name,
        "yes" if has_top else "no",
        "yes" if write_all else "no",
        "yes" if id_token else "no",
        "yes" if contents else "no",
        "yes" if actions  else "no",
        "yes" if packages else "no",
        str(n),
        ",".join(secret_names) or "-",
        ",".join(flags) or "-",
    ]) + "\n")
PY
done

total=$(($(wc -l < "$OUT") - 1))
no_top=$(awk -F'\t' 'NR>1 && $2=="no"' "$OUT" | wc -l)
write_all=$(awk -F'\t' 'NR>1 && $3=="yes"' "$OUT" | wc -l)
deploy=$(awk -F'\t' 'NR>1 && $4=="yes" && $5=="yes"' "$OUT" | wc -l)

echo "Total workflows:       $total"
echo "Missing top-level perms: $no_top"
echo "write-all granted:     $write_all"
echo "Deploy-capable (OIDC+contents:write): $deploy"
echo "Report: $OUT"
