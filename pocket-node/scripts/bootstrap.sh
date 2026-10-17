#!/usr/bin/env bash
set -euo pipefail

ROOT="${1:-${D3VONN_POCKET_ROOT:-}}"
if [[ -z "$ROOT" ]]; then
  echo "usage: $0 /path/to/D3VONN_POCKET" >&2
  exit 2
fi

mkdir -p \
  "$ROOT/runtime/bin" \
  "$ROOT/models/general" "$ROOT/models/coding" "$ROOT/models/embeddings" "$ROOT/models/speech" \
  "$ROOT/memory/vectors" "$ROOT/memory/knowledge-graph" "$ROOT/memory/conversations" "$ROOT/memory/checkpoints" \
  "$ROOT/rag/documents" "$ROOT/rag/indexes" \
  "$ROOT/workspace/repos" "$ROOT/workspace/projects" "$ROOT/workspace/exports" \
  "$ROOT/vault" "$ROOT/logs" "$ROOT/config" "$ROOT/manifests"

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
if [[ ! -f "$ROOT/config/pocket-node.env" ]]; then
  cp "$PROJECT_DIR/config/pocket-node.env.example" "$ROOT/config/pocket-node.env"
  chmod 600 "$ROOT/config/pocket-node.env" || true
fi

if [[ ! -f "$ROOT/manifests/SHA256SUMS" ]]; then
  : > "$ROOT/manifests/SHA256SUMS"
fi

printf 'D3VONN Pocket Node initialized at %s\n' "$ROOT"
printf 'Next: add trusted llama-server + GGUF model, generate SHA256SUMS, then launch.\n'
