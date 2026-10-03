#!/usr/bin/env bash
set -euo pipefail
ROOT="${1:-${D3VONN_POCKET_ROOT:-}}"
[[ -n "$ROOT" ]] || { echo "drive root required" >&2; exit 2; }
MANIFEST="$ROOT/manifests/SHA256SUMS"
[[ -s "$MANIFEST" ]] || { echo "integrity manifest is empty or missing" >&2; exit 3; }
(cd "$ROOT" && sha256sum -c manifests/SHA256SUMS)
