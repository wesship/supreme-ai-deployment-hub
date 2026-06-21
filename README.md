# Devonn.ai — Supreme AI Deployment Hub

Devonn.ai is an AI-powered deployment, operations, and agent orchestration hub. This repository is the main application workspace for the Devonn.ai platform: a Vite/React operator frontend, FastAPI backend services, Supabase-backed authentication and logging, protected admin tooling, CI/security gates, and production deployment workflows.

The current milestone is the merged Operator Command Center (OCC), delivered through PR #202.

## Current production status

| Area | Status |
|---|---|
| Main branch | Green after PR #202 merge |
| Latest OCC merge commit | `af858feed4989e2763ccdafe02a05e8aa742e05e` |
| Frontend | Vite + React + Tailwind + shadcn-style UI |
| Backend | FastAPI admin/API services |
| Auth/data layer | Supabase |
| CI/security | CodeQL, Gitleaks, TruffleHog, dependency review, coverage, E2E, hardened build gates |
| Admin dashboard | Operator Command Center on `/admin` |
| Package manager | pnpm |

## What this repo contains

Devonn.ai combines multiple production layers:

- **Operator Command Center (OCC):** protected admin dashboard for AI cost tracking, tool logs, agent logs, RAG document management, approvals, errors, and user plans.
- **Frontend application:** Vite/React UI with production build tooling and dashboard routes.
- **Backend proxy/API layer:** FastAPI routers for platform capabilities and admin APIs.
- **Supabase integration:** authentication, app metadata roles, logging tables, user plans, and RAG metadata.
- **Security workflows:** CodeQL, secret scanning, dependency review, Trivy, hardened CI, action pin validation, and governance checks.
- **Operational tooling:** workflow audits, CI doctor, repo entropy scanning, memory export/compression, connector auditing, and deployment checks.

## Operator Command Center

The OCC is the platform operator cockpit.

### OCC features

1. Overview metrics
2. AI request logs
3. AI cost and token tracking
4. Tool call logs
5. Agent activity logs
6. RAG document manager
7. Approval queue
8. Error monitoring and resolution
9. User plan management

### OCC routes

| Surface | Route |
|---|---|
| Admin UI | `/admin` |
| Admin API | `/api/admin/*` |
| Overview API | `/api/admin/overview` |

### OCC security model

- A valid Supabase-authenticated user is required.
- Admin access requires `app_metadata.role = admin`.
- Missing backend admin configuration returns `503`.
- Non-admin access returns `403`.
- Supabase outbound hosts are restricted to approved Supabase domains.
- Admin path parameters are UUID validated.
- Table access is allow-listed.
- `ALLOW_DEV_ADMIN_BYPASS=true` is local-development only and must never be enabled in production.

Read the full runbook: [`docs/OCC_RUNBOOK.md`](docs/OCC_RUNBOOK.md)

## Quick start

### Requirements

- Node.js `>=22`
- pnpm
- Supabase project
- Optional: Python/FastAPI environment for backend-local development

### Install

```bash
pnpm install
```

### Run local frontend

```bash
pnpm dev
```

### Build

```bash
pnpm build
```

### Test and validate

```bash
pnpm typecheck
pnpm lint
pnpm test
pnpm test:coverage
pnpm build
```

### CI/operator diagnostics

```bash
pnpm ci:doctor
pnpm workflow:audit
pnpm pins:validate
pnpm repo:entropy
pnpm connectors:audit
```

## Environment variables

### Frontend

Use Vite-prefixed variables for browser-safe frontend configuration only.

```bash
VITE_SUPABASE_URL=
VITE_SUPABASE_PUBLISHABLE_KEY=
VITE_API_URL=
VITE_ENVIRONMENT=production
```

Never expose service-role keys or private API keys with a `VITE_` prefix.

### Backend/admin API

```bash
SUPABASE_URL=https://<project-ref>.supabase.co
SUPABASE_SERVICE_ROLE_KEY=<server-side-service-role-key>
ALLOW_DEV_ADMIN_BYPASS=false
```

Production must have `ALLOW_DEV_ADMIN_BYPASS=false` or unset.

## Production verification

Run after each production deployment.

```bash
curl -I https://d3vonn.io
```

Expected: successful site response or expected hosting redirect.

```bash
curl -i https://d3vonn.io/api/admin/overview
```

Expected: `401`, `403`, or `503`. Public requests must never return admin data.

```bash
curl -i \
  -H "Authorization: Bearer <non-admin-user-jwt>" \
  https://d3vonn.io/api/admin/overview
```

Expected: `403 Admin access required`.

```bash
curl -i \
  -H "Authorization: Bearer <admin-user-jwt>" \
  https://d3vonn.io/api/admin/overview
```

Expected: `200` with OCC summary data.

## Supabase requirements for OCC

The OCC expects these tables or compatible views:

- `ai_request_logs`
- `tool_call_logs`
- `agent_activity_logs`
- `error_logs`
- `approval_queue`
- `user_plans`
- `rag_documents`

Admin users should have this Supabase Auth user metadata:

```json
{
  "role": "admin"
}
```

## CI and governance

This repository uses a hardened CI/governance posture. Core checks include:

- CodeQL SAST
- Gitleaks
- TruffleHog
- Dependency Review
- Security Hardening
- CI - Hardened Build Pipeline
- API Contract Testing
- Devonn.AI Testing
- E2E Tests
- Coverage Enforcement
- Lighthouse CI
- Bundle Size Check
- Governance Drift Check
- Final Green Check

Branch protection should remain active on `main`. Any temporary bypass must be removed immediately after the approved merge operation.

## Documentation map

| Document | Purpose |
|---|---|
| [`docs/OCC_RUNBOOK.md`](docs/OCC_RUNBOOK.md) | Operator Command Center operation, security, and smoke tests |
| [`docs/POST_MERGE_STATUS_PR_202.md`](docs/POST_MERGE_STATUS_PR_202.md) | PR #202 merge summary and stabilization record |
| [`docs/ECOSYSTEM.md`](docs/ECOSYSTEM.md) | Devonn autonomous ecosystem context, if present |
| [`PRODUCTION_RUNBOOK.md`](PRODUCTION_RUNBOOK.md) | Production operations, if present |
| [`ARCHITECTURE.md`](ARCHITECTURE.md) | System architecture, if present |

## Recommended next milestones

1. Add Supabase migrations for all OCC tables.
2. Add an automated production smoke-test workflow for `/api/admin/overview`.
3. Add screenshots or short recordings of the OCC dashboard.
4. Add an admin onboarding guide for creating the first Supabase admin user.
5. Tag the OCC milestone release, for example `v1.1.0-occ`.
6. Confirm Vercel production environment variables after each major merge.
7. Add rollback steps for admin/API failures into the production runbook.

## Security notes

- Never commit `.env` files or secrets.
- Never expose service-role keys to the browser.
- Keep branch protection enabled.
- Rotate any key that appears in logs, screenshots, PR comments, or local terminal output.
- Use server-side routes for all privileged provider/API actions.
- Treat `/api/admin/*` as a privileged control surface.

## License

License status should be finalized before broad external distribution. Until a license is selected, all rights are reserved by the repository owner.
