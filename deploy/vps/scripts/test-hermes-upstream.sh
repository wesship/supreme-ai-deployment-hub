#!/usr/bin/env bash
set -euo pipefail

VENV_DIR="${HERMES_UPSTREAM_VENV_DIR:-$HOME/.hermes/venvs/d3vonn-upstream}"
EXPECTED_VERSION="${HERMES_UPSTREAM_VERSION:-0.20.5}"

if [[ ! -x "$VENV_DIR/bin/hermes" ]]; then
  echo "Hermes upstream executable not found: $VENV_DIR/bin/hermes" >&2
  echo "Run deploy/vps/scripts/update-hermes-upstream.sh first." >&2
  exit 1
fi

export PATH="$VENV_DIR/bin:$PATH"
VERSION_OUTPUT="$(hermes --version)"
CONFIG_OUTPUT="$(hermes config check)"

grep -F "$EXPECTED_VERSION" <<<"$VERSION_OUTPUT" >/dev/null || {
  echo "Unexpected Hermes version: $VERSION_OUTPUT" >&2
  exit 1
}

printf '%s\n' "$VERSION_OUTPUT"
printf '%s\n' "$CONFIG_OUTPUT"
printf '%s\n' "Hermes upstream compatibility preflight passed for $EXPECTED_VERSION"
