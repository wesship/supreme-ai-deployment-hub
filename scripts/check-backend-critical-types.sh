#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "${BASH_SOURCE[0]}")/.."
# Use the repository package root; imports must resolve as backend.app, not app.
# Imported modules retain their inferred types, but their existing diagnostics
# belong to the separately published full-backend backlog report.
python -m mypy \
  -m backend.app.security.approval_execution \
  -m backend.middleware.rate_limit \
  -m backend.occ_operator.public_stats_router \
  -m backend.app.routers.runtime_identity \
  -m backend.app.services.token_governor \
  --follow-imports=silent --ignore-missing-imports --no-error-summary
