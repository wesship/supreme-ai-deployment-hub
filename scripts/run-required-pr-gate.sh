#!/usr/bin/env bash
set -euo pipefail

export VITE_API_URL="${VITE_API_URL:-https://api.d3vonn.io}"
export VITE_ENVIRONMENT="${VITE_ENVIRONMENT:-production}"
export REQUIRE_AUTH="${REQUIRE_AUTH:-false}"
export ALLOW_DEV_ADMIN_BYPASS="${ALLOW_DEV_ADMIN_BYPASS:-false}"

run_group() {
  local label="$1"
  shift
  echo "::group::${label}"
  "$@"
  echo "::endgroup::"
}

run_group "Frontend TypeScript type-check" pnpm typecheck
run_group "Frontend lint" pnpm lint
run_group "Frontend unit tests" pnpm test
run_group "Production frontend build" pnpm build

run_group "Backend syntax check" python -m compileall -q backend
run_group "Backend import check" python -c "from backend.main import app; assert app is not None"
run_group "Focused backend tests" python -m pytest \
  backend/tests/test_proxy_routes.py \
  backend/tests/test_ai_film_provider_adapters.py \
  tests/test_readiness.py \
  -q

run_group "Secret scan" pnpm security:scan
run_group "Workflow YAML validation" python3 scripts/validate_workflows.py --mode yaml
run_group "GitHub Action reference validation" python3 scripts/validate_workflows.py --mode actions
run_group "Workflow audit" pnpm workflow:audit
run_group "CI doctor" pnpm ci:doctor

echo "D3VONN Required PR Gate: PASS"
