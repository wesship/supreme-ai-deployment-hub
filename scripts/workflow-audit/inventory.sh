#!/usr/bin/env bash
# Workflow metadata inventory — deterministic and read-only.
set -euo pipefail
cd "$(dirname "$0")/../.."
python3 scripts/workflow-audit/generate_inventory.py
