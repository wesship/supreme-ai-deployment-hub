#!/usr/bin/env bash
set -euo pipefail

ROOT="${D3VONN_POCKET_ROOT:-}"
if [[ -z "$ROOT" ]]; then
  echo "D3VONN_POCKET_ROOT is required" >&2
  exit 2
fi
CONFIG="$ROOT/config/pocket-node.env"
[[ -f "$CONFIG" ]] || { echo "missing $CONFIG" >&2; exit 3; }

set -a
# shellcheck disable=SC1090
source "$CONFIG"
set +a

MODE="${POCKET_MODE:-AIRGAP}"
HOST="${POCKET_BIND_HOST:-127.0.0.1}"
PORT="${POCKET_PORT:-11435}"
MODEL="$ROOT/${POCKET_MODEL:-models/general/model.gguf}"
SERVER="$ROOT/runtime/bin/llama-server"

case "$MODE" in
  AIRGAP|LOCAL|BRIDGE|MAINTENANCE) ;;
  *) echo "invalid POCKET_MODE: $MODE" >&2; exit 4 ;;
esac

if [[ "$MODE" == "AIRGAP" && "$HOST" != "127.0.0.1" && "$HOST" != "::1" ]]; then
  echo "AIRGAP mode requires loopback binding" >&2
  exit 5
fi

if [[ "$MODE" == "BRIDGE" ]]; then
  [[ -n "${D3VONN_BRIDGE_ENDPOINT:-}" ]] || { echo "BRIDGE endpoint required" >&2; exit 6; }
  [[ -n "${D3VONN_BRIDGE_TOKEN:-}" ]] || { echo "BRIDGE token required" >&2; exit 7; }
fi

[[ -x "$SERVER" ]] || { echo "missing executable: $SERVER" >&2; exit 8; }
[[ -f "$MODEL" ]] || { echo "missing model: $MODEL" >&2; exit 9; }

if [[ -s "$ROOT/manifests/SHA256SUMS" ]]; then
  (cd "$ROOT" && sha256sum -c manifests/SHA256SUMS)
fi

ARGS=(--host "$HOST" --port "$PORT" --model "$MODEL" --ctx-size "${POCKET_CONTEXT_SIZE:-8192}")
if [[ "${POCKET_THREADS:-0}" != "0" ]]; then ARGS+=(--threads "$POCKET_THREADS"); fi
if [[ "${POCKET_GPU_LAYERS:-0}" != "0" ]]; then ARGS+=(--n-gpu-layers "$POCKET_GPU_LAYERS"); fi

echo "Starting D3VONN Pocket Node mode=$MODE host=$HOST port=$PORT"
exec "$SERVER" "${ARGS[@]}"
