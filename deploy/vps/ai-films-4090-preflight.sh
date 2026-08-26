#!/usr/bin/env bash
set -euo pipefail

fail() { echo "FAIL: $*" >&2; exit 1; }

command -v nvidia-smi >/dev/null 2>&1 || fail "nvidia-smi is not installed or not on PATH"
command -v docker >/dev/null 2>&1 || fail "docker is not installed or not on PATH"

GPU_NAME="$(nvidia-smi --query-gpu=name --format=csv,noheader | head -n1 | xargs)"
GPU_VRAM="$(nvidia-smi --query-gpu=memory.total --format=csv,noheader | head -n1 | xargs)"
[[ "$GPU_NAME" == *"4090"* ]] || fail "expected RTX 4090, detected: ${GPU_NAME:-unknown}"

echo "GPU: $GPU_NAME"
echo "VRAM: $GPU_VRAM"

python3 - <<'PY'
import importlib.util
missing = [m for m in ("torch",) if importlib.util.find_spec(m) is None]
if missing:
    raise SystemExit("FAIL: missing Python modules: " + ", ".join(missing))
import torch
if not torch.cuda.is_available():
    raise SystemExit("FAIL: PyTorch CUDA is unavailable")
print("PyTorch:", torch.__version__)
print("CUDA runtime:", torch.version.cuda)
print("CUDA device:", torch.cuda.get_device_name(0))
print("VRAM GiB:", round(torch.cuda.get_device_properties(0).total_memory / 1024**3, 2))
PY

docker info >/dev/null || fail "Docker daemon is unavailable"

echo "PASS: RTX 4090 preflight"
