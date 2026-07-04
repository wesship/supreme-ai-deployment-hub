#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../../.." && pwd)"
ENV_DIR="$ROOT_DIR/deploy/vps/env"
TEMPLATE="$ENV_DIR/.env.example"
TARGET="$ENV_DIR/.env.production"

if [[ ! -f "$TEMPLATE" ]]; then
  echo "Missing template: $TEMPLATE" >&2
  exit 1
fi

if [[ -f "$TARGET" ]]; then
  chmod 600 "$TARGET"
  echo "Existing env file found and permissions set: $TARGET"
  exit 0
fi

cp "$TEMPLATE" "$TARGET"
chmod 600 "$TARGET"
echo "Created $TARGET from template. Edit it locally on the VPS before starting Docker Compose."
