# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added
- **Phase 20:** Final green-light checklist and CI stabilization
- **Phase 19:** Automated secrets rotation script (`scripts/rotate_secrets.sh`), SBOM generation (`.github/workflows/sbom.yml`)
- **Phase 18:** Mutation testing workflow (`.github/workflows/mutation-tests.yml`), comprehensive backend unit tests (`backend/tests/test_api_v1.py`, `backend/tests/test_auth.py`)
- **Phase 17:** OpenAPI documentation (`docs/api/openapi.yaml`), API v2 router scaffold (`backend/api/v2/router.py`)
- **Phase 16:** Prometheus alerting rules, multi-tenancy scaffold, Redis Kubernetes deployment, Admin UI components (TaskQueue, FeatureFlagManager), worker deploy workflow, operational scripts (backup, rollback)
- **Phase 15:** Background task worker (`backend/tasks/worker.py`), WebSocket router, JWT authentication, Supabase RLS policies, production deployment runbook
- **Phase 14:** Async PostgreSQL connection pool (`backend/db/pool.py`), Redis-backed background task queue, API v1 versioned router, Admin Dashboard UI, end-to-end deployment validation script
- **Phase 13:** Redis cache layer, rate limiting middleware, structured JSON request logging middleware, WebSocket connection manager, Docker publish workflow, README overhaul
- **Phase 12:** Kubernetes TLS & security hardening (`ingress.yaml`, `cert-manager.yaml`, `secrets-external.yaml`), integration test suite, backend unit tests, architecture documentation (`docs/ARCHITECTURE.md`), community health files (`CODE_OF_CONDUCT.md`, `supabase/seed.sql`)
- **Phase 11:** Backend FastAPI entry point (`backend/main.py`), pinned Python dependencies (`backend/requirements.txt`), Deno configuration for Supabase edge functions, Grafana dashboard (`monitoring/grafana-dashboard.json`), CI stabilization patches, secrets onboarding validation script (`scripts/validate_secrets.sh`)
- **Phase 10:** Multi-agent mesh REST communication layer, feature flag system (`src/lib/featureFlags.ts`), expanded Playwright E2E suite
- **Phase 9:** Secure environment configuration (`src/lib/env.ts`), React Error Boundary, `vitest.config.ts`, accessibility CI workflow, dependency review workflow, coverage enforcement workflow, centralized health check hook (`useAgentHealth.ts`)
- **Phase 8:** Hardened Chrome extension (`manifest.json`, `background.js`), Falco runtime security rules, IaC drift detection workflow, hardened clone automation script
- **Phase 7:** AI model governance OPA policy, cost optimization workflow, Devonn.AI agent mesh health check, Chaos engineering test scaffold, disaster recovery runbook
- **Phase 6:** Hardened Helm values (Prometheus, Loki), secure Supabase Edge Function CI/CD, multi-environment promotion workflow
- **Phase 5:** Kubernetes manifest hardening (security contexts, limits, HPA, PDB, NetworkPolicy), production k6 load testing, Sentry observability integration, Developer Experience (DX) tooling (Commitlint, GitHub templates)
- **Phase 4:** Fixed runaway Autonomous Fix Engine, Lighthouse CI & performance budgets, bundle size tracking, stale PR cleanup workflow, observability setup guide
- **Phase 3b:** Playwright E2E testing scaffold, full local Docker dev stack, CodeQL SAST workflow, Semantic Release workflow
- **Phase 3:** Fixed Terraform CI/CD secret leakage, frontend/backend directory separation, Supabase migrations setup
- **Phase 1-2:** Core CI hardening (`build.yml`, `testing.yml`, `deploy.yml`, `auto-fix.yml`, `vercel.json`, `tsconfig.app.json`, `.npmrc`)

### Changed
- Refactored entire repository structure to separate frontend (`src/`) and backend (`backend/`) contexts
- Upgraded GitHub Actions to use latest node, python, and action versions (e.g., `@v4`)
- Hardened all Dockerfiles to use multi-stage builds, non-root users, and pinned base images

### Fixed
- Fixed runaway `auto-fix.yml` cron schedule
- Fixed critical secret leakage in `infrastructure-ci-cd.yml` Terraform plan artifacts
- Fixed Chrome extension `background.js` reference error and added auth token support
- Fixed missing typecheck gate in Vercel deployment pipeline

### Removed
- Removed `.env` file from version control
- Removed duplicate Slack notifications in deploy workflow
- Removed `bun.lock` / `bun.lockb` to prevent dual lock file conflicts
