#!/usr/bin/env bash
# Inject `permissions: { contents: read }` at the top of workflows that
# currently have no top-level permissions block. Least-privilege default.
# Workflows that need write access already declare their own block and are
# left untouched.
set -euo pipefail
cd "$(dirname "$0")/../.."

modified=0
for f in .github/workflows/*.yml; do
  # Skip if a top-level permissions block already exists (not nested under jobs:)
  if awk '
    /^permissions:/ { found=1; exit }
    /^jobs:/        { exit }
    END             { exit !found }
  ' "$f"; then
    continue
  fi

  # Insert after the first blank line following `on:` block, or before `jobs:`.
  python3 - "$f" << 'PY'
import pathlib, sys, re
p = pathlib.Path(sys.argv[1])
lines = p.read_text().splitlines(keepends=True)
out = []
inserted = False
for i, line in enumerate(lines):
    if not inserted and re.match(r"^jobs:\s*$", line):
        out.append("permissions:\n")
        out.append("  contents: read\n")
        out.append("\n")
        inserted = True
    out.append(line)
if inserted:
    p.write_text("".join(out))
    print(f"MODIFIED {p}")
else:
    print(f"SKIP    {p} (no jobs: anchor)", file=sys.stderr)
PY
done

echo "Done. Re-fingerprint with scripts/fingerprint-workflows.sh"
