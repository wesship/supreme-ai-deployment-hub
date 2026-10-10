#!/usr/bin/env bash
set -euo pipefail

fail() { echo "ERROR: $*" >&2; exit 1; }
info() { echo "==> $*"; }

: "${MUSIC_QUALIFICATION_ROOT:?MUSIC_QUALIFICATION_ROOT must be set}"

ROOT_REAL="$(realpath -e "$MUSIC_QUALIFICATION_ROOT")"
[[ -d "$ROOT_REAL" ]] || fail "MUSIC_QUALIFICATION_ROOT must be an existing directory"
[[ "$ROOT_REAL" != "/" ]] || fail "MUSIC_QUALIFICATION_ROOT may not be /"

info "qualification root: $ROOT_REAL"

for cmd in bash git node python3 realpath sha256sum nvidia-smi; do
  command -v "$cmd" >/dev/null 2>&1 || fail "required command missing: $cmd"
done

info "node: $(node --version)"
info "python: $(python3 --version 2>&1)"
info "git: $(git --version)"

GPU_LINES="$(nvidia-smi --query-gpu=name,driver_version,memory.total --format=csv,noheader 2>/dev/null || true)"
[[ -n "$GPU_LINES" ]] || fail "nvidia-smi could not read an NVIDIA GPU"
printf '%s\n' "$GPU_LINES"

python3 - <<'PY'
import sys
try:
    import torch
except Exception as exc:
    raise SystemExit(f"PyTorch import failed: {type(exc).__name__}: {exc}")
print(f"torch={torch.__version__}")
print(f"cuda_runtime={torch.version.cuda}")
print(f"cuda_available={torch.cuda.is_available()}")
if not torch.cuda.is_available():
    raise SystemExit("CUDA is not available to PyTorch")
print(f"cuda_device_count={torch.cuda.device_count()}")
print(f"cuda_device_0={torch.cuda.get_device_name(0)}")
PY

if [[ -n "${RUNNER_OS:-}" && "$RUNNER_OS" != "Linux" ]]; then
  fail "GitHub runner must report RUNNER_OS=Linux; got $RUNNER_OS"
fi

if [[ -n "${RUNNER_NAME:-}" ]]; then
  info "runner name detected: $RUNNER_NAME"
fi

info "filesystem write test"
TMP_DIR="$(mktemp -d "$ROOT_REAL/.d3vonn-preflight.XXXXXX")"
trap 'rm -rf "$TMP_DIR"' EXIT
printf 'd3vonn-music-runner-preflight\n' > "$TMP_DIR/probe.txt"
sha256sum "$TMP_DIR/probe.txt" >/dev/null

cat <<EOF

PASS: private GPU runner prerequisites are present.

GitHub configuration still required outside this script:
  - self-hosted runner registered to wesship/supreme-ai-deployment-hub
  - labels include: self-hosted, linux, d3vonn-gpu
  - runner service account exports MUSIC_QUALIFICATION_ROOT=$ROOT_REAL
  - pinned ACE-Step model artifacts live below that root
  - exact CycloneDX SBOM for the digest-pinned runtime image lives below that root
  - workflow is dispatched manually from main by the repository owner
EOF
