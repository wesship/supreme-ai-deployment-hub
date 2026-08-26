#!/usr/bin/env bash
set -euo pipefail

# Update the upstream Nous Hermes Agent without replacing D3VONN's own
# backend/hermes control-plane/runtime. This keeps the two layers separable.

REPO="${HERMES_UPSTREAM_REPO:-https://github.com/NousResearch/hermes-agent.git}"
TAG="${HERMES_UPSTREAM_TAG:-v2026.8.19}"
INSTALL_DIR="${HERMES_UPSTREAM_INSTALL_DIR:-/opt/d3vonn/hermes-agent}"
VENV_DIR="${HERMES_UPSTREAM_VENV_DIR:-$HOME/.hermes/venvs/d3vonn-upstream}"

mkdir -p "$(dirname "$INSTALL_DIR")"

if [[ -d "$INSTALL_DIR/.git" ]]; then
  git -C "$INSTALL_DIR" fetch --tags origin
else
  git clone --filter=blob:none --no-checkout "$REPO" "$INSTALL_DIR"
  git -C "$INSTALL_DIR" fetch --tags origin
fi

git -C "$INSTALL_DIR" checkout --force "$TAG"

if ! command -v uv >/dev/null 2>&1; then
  echo "uv is required; install uv before running this updater." >&2
  exit 1
fi

uv venv --allow-existing "$VENV_DIR"
uv pip install --python "$VENV_DIR/bin/python" -e "$INSTALL_DIR[all]"

export PATH="$VENV_DIR/bin:$PATH"
hermes --version
hermes config check

echo "Upstream Nous Hermes pinned to $TAG ($TAG) at $INSTALL_DIR"
