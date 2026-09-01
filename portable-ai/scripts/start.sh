#!/usr/bin/env bash
set -euo pipefail
PORTABLE_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$PORTABLE_ROOT"
export PYTHONUNBUFFERED=1
exec python3 gateway/server.py
