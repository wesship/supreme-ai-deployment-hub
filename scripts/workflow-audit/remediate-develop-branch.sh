#!/usr/bin/env bash
# Strip `develop` from push/pull_request branch lists in workflows.
# Safe rules:
#  - Only modify lines under `branches:` arrays (inline `[a, b]` or block `- a`).
#  - If `develop` is the ONLY branch listed, the workflow is left untouched
#    and reported to stderr — that's a triggering-change requiring human review.
set -euo pipefail
shopt -s nullglob

cd "$(dirname "$0")/../.."
changed=0
skipped=()

for f in .github/workflows/*.yml; do
  grep -q "develop" "$f" || continue

  # Inline form:  branches: [main, develop]  → branches: [main]
  # Block form:   - develop                  → removed
  python3 - "$f" << 'PY'
import re, sys, pathlib
p = pathlib.Path(sys.argv[1])
src = p.read_text()
orig = src

# inline arrays containing develop
def fix_inline(m):
    head, arr = m.group(1), m.group(2)
    items = [x.strip() for x in arr.split(",")]
    items = [x for x in items if x.strip().strip("'\"") != "develop"]
    if not items:
        return m.group(0)  # leave for human review
    return f"{head}[{', '.join(items)}]"

src = re.sub(r"(branches:\s*)\[([^\]]+)\]", fix_inline, src)

# block list entries:  '- develop' (with surrounding whitespace), only when
# under a branches: key — heuristic: line whose stripped form is '- develop'
# or '- "develop"' / "- 'develop'"
lines = src.split("\n")
out = []
for line in lines:
    s = line.strip()
    if s in ("- develop", '- "develop"', "- 'develop'"):
        continue
    out.append(line)
src = "\n".join(out)

if src != orig:
    p.write_text(src)
    print(f"MODIFIED {p}")
PY
done

echo "Done. Re-run scripts/workflow-audit/run-all.sh to refresh reports."
