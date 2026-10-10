#!/usr/bin/env bash
set -euo pipefail

SUPERPOWERS_REF="5bf4e78011075bcfc0dc295f0724994cd123ee71"

command -v hermes >/dev/null 2>&1 || {
  echo "Hermes CLI not found in PATH" >&2
  exit 1
}

echo "Installing pinned Superpowers plugin..."
hermes plugins install obra/superpowers --ref "$SUPERPOWERS_REF" --enable

echo "Validating plugin through Hermes loader..."
hermes plugins doctor superpowers --ci

echo "Installed and validated Superpowers at $SUPERPOWERS_REF"
echo "Restart active Hermes sessions before use."
