#!/usr/bin/env bash
set -euo pipefail

# DEVONN.AI workflow package-manager patch helper.
# Run from repo root after pulling main.

SELF_HEALING=".github/workflows/self-healing-v2.yml"
INFRA=".github/workflows/infrastructure-ci-cd.yml"

if [ -f "$SELF_HEALING" ]; then
  python3 - <<'PY'
from pathlib import Path
p = Path('.github/workflows/self-healing-v2.yml')
s = p.read_text()
old = """          if os.path.exists('pnpm-lock.yaml'):\n              package_manager = 'pnpm'\n              lockfile = 'pnpm-lock.yaml'\n          elif os.path.exists('package-lock.json'):\n              package_manager = 'npm'\n              lockfile = 'package-lock.json'\n          elif os.path.exists('yarn.lock'):\n              package_manager = 'yarn'\n              lockfile = 'yarn.lock'\n"""
new = """          if os.path.exists('bun.lock') or os.path.exists('bun.lockb'):\n              package_manager = 'bun'\n              lockfile = 'bun.lock' if os.path.exists('bun.lock') else 'bun.lockb'\n          elif os.path.exists('pnpm-lock.yaml'):\n              package_manager = 'pnpm'\n              lockfile = 'pnpm-lock.yaml'\n          elif os.path.exists('package-lock.json'):\n              package_manager = 'npm'\n              lockfile = 'package-lock.json'\n          elif os.path.exists('yarn.lock'):\n              package_manager = 'yarn'\n              lockfile = 'yarn.lock'\n"""
if old not in s:
    print('self-healing package-manager block already patched or pattern not found')
else:
    p.write_text(s.replace(old, new))
    print('patched self-healing bun lockfile detection')
PY
fi

if [ -f "$INFRA" ]; then
  python3 - <<'PY'
from pathlib import Path
p = Path('.github/workflows/infrastructure-ci-cd.yml')
s = p.read_text()
old = """      - name: Install Node dependencies\n      - name: Setup pnpm\n        uses: pnpm/action-setup@a7487c7e89a18df4991f7f222e4898a00d66ddda  # v4.1.0\n        with:\n          version: 9\n\n        run: pnpm install --frozen-lockfile\n"""
new = """      - name: Setup pnpm\n        uses: pnpm/action-setup@a7487c7e89a18df4991f7f222e4898a00d66ddda  # v4.1.0\n        with:\n          version: 9\n\n      - name: Install Node dependencies\n        run: pnpm install --frozen-lockfile\n"""
if old not in s:
    print('infra malformed pnpm block already patched or pattern not found')
else:
    p.write_text(s.replace(old, new))
    print('patched infrastructure malformed pnpm install block')
PY
fi

git diff -- .github/workflows/self-healing-v2.yml .github/workflows/infrastructure-ci-cd.yml
