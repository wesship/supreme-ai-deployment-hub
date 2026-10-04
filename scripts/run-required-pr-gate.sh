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
run_group "Frontend unit tests and coverage" pnpm test:coverage
run_group "Coverage baseline enforcement" node scripts/check-coverage-summary.mjs
run_group "High-severity production dependency audit" pnpm audit --prod --audit-level=high
run_group "Production frontend build" pnpm build

run_group "Release-critical backend type-check" bash scripts/check-backend-critical-types.sh

run_group "Backend syntax check" python -m compileall -q backend
run_group "Backend import check" python -c "from backend.main import app; assert app is not None"
run_group "Focused backend tests" python -m pytest \
  backend/tests/test_proxy_routes.py \
  backend/tests/test_approval_execution.py \
  backend/tests/test_security_middleware_gate2r.py \
  backend/tests/test_public_stats.py \
  backend/tests/test_required_routes.py \
  backend/tests/test_production_lifecycle_canary.py \
  backend/tests/test_ai_film_provider_adapters.py \
  backend/tests/test_security_event_ingestion_v2.py \
  backend/tests/test_event_os_checkout.py \
  backend/tests/test_production_acceptance.py \
  tests/ai_films/test_role_authoring.py \
  backend/tests/test_hermes_proactivity.py \
  tests/test_readiness.py \
  -q

run_group "Security boundary coverage" python -m pytest \
  backend/tests/test_approval_execution.py \
  backend/tests/test_security_middleware_gate2r.py \
  backend/tests/test_public_stats.py \
  --cov=backend.app.security.approval_execution \
  --cov=backend.middleware.rate_limit \
  --cov=backend.occ_operator.public_stats_router \
  --cov-fail-under=90 --cov-report=term-missing \
  --cov-report=json:coverage/backend-security.json -q

run_group "Per-module security coverage" node scripts/check-coverage-summary.mjs --security

run_group "Secret scan" pnpm security:scan
run_group "Workflow YAML validation" python3 scripts/validate_workflows.py --mode yaml
run_group "GitHub Action reference validation" python3 scripts/validate_workflows.py --mode actions
run_group "Workflow audit" pnpm workflow:audit
run_group "CI doctor" pnpm ci:doctor

echo "D3VONN Required PR Gate: PASS"
