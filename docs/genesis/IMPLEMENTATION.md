# Genesis Platform Foundation

The Genesis platform is now split across reviewed, current-main extraction PRs rather than the original long-lived vertical-slice branch.

## Delivered

- Supabase/PostgreSQL schema for Genesis projects, canon, tasks, workflows, approvals, render requests, events, quality evaluation, and atomic mutation RPCs.
- Row-Level Security, project membership checks, governed role enforcement, and backend-only privileged access.
- FastAPI `/api/genesis/*` services and authenticated Creator UI surfaces.
- Deterministic workflow/task state contracts, render routing, cost estimates, approval thresholds, and manual-provider fallback.
- Genesis command and quality surfaces, governed database foundation, backend service layer, and current security hardening.

## Safe rollout order

1. Merge code only after required CI/security checks pass.
2. Preview Genesis migrations against staging using the guarded staging workflow.
3. Apply Genesis migrations to staging only through an explicit workflow dispatch using `APPLY_GENESIS_STAGING`.
4. Verify `/api/genesis/health` reports `workflow_runtime: ready` and `data_model: ready`.
5. Run authenticated owner/viewer acceptance and tenant-boundary tests.
6. Configure external provider credentials server-side and validate preview render routing.
7. Promote to production only through a separate explicit release step after staging acceptance passes.

## Required backend configuration

```text
SUPABASE_URL
SUPABASE_SERVICE_ROLE_KEY
```

Optional provider configuration:

```text
OPENAI_API_KEY
ELEVENLABS_API_KEY
GENESIS_VIDEO_API_KEY or RUNWAY_API_KEY
GENESIS_LOCAL_WORKER_URL
GENESIS_RENDER_APPROVAL_USD
GENESIS_OPENAI_IMAGE_MODEL
GENESIS_VIDEO_MODEL
GENESIS_VOICE_MODEL
GENESIS_LOCAL_MEDIA_MODEL
```

Provider keys remain server-side and must never be returned to the Creator UI or embedded in prompts.

## Core API surface

```text
GET    /api/genesis/health
GET    /api/genesis/providers
GET    /api/genesis/projects
POST   /api/genesis/projects
GET    /api/genesis/projects/{project_id}/command-center
GET    /api/genesis/projects/{project_id}/snapshot
POST   /api/genesis/projects/{project_id}/canon
POST   /api/genesis/projects/{project_id}/goals
POST   /api/genesis/projects/{project_id}/workflows/bootstrap
GET    /api/genesis/projects/{project_id}/tasks
PATCH  /api/genesis/tasks/{task_id}/transition
POST   /api/genesis/projects/{project_id}/render-requests
POST   /api/genesis/approvals/{approval_id}/decide
POST   /api/genesis/projects/{project_id}/evaluate
GET    /api/genesis/projects/{project_id}/evaluations
```

## Current execution boundary

The governed vertical slice reaches render planning, approval, quality evaluation, and provider routing. External provider submission remains adapter/configuration dependent. When no provider credential is configured, the router uses `manual_gateway` rather than pretending an automated render occurred.

## Validation commands

```bash
pnpm typecheck
pnpm build
python -m compileall -q backend/genesis
python -m pytest backend/tests/test_genesis_platform.py -q
```

## Acceptance path

1. A signed-in user creates a Genesis project.
2. Project-scoped canon and agents are established under role checks.
3. Bootstrap creates dependency-aware workflow tasks.
4. Tasks advance only through valid governed transitions.
5. Render requests receive bounded cost estimates and provider routes.
6. Requests above policy thresholds require approval.
7. Quality evaluation can block release when canon, workflow, asset, or provider readiness is incomplete.
8. Consequential mutations use atomic database operations and durable event/audit evidence.

## Certification workflows

- `Genesis Platform Verification` performs frontend type/build checks plus the focused Genesis backend certification suite.
- `Genesis Staging Rollout` is preview-only on pull requests. Staging database mutation requires an explicit manual dispatch and confirmation token.
- `Genesis Backend Staging` probes the isolated staging API on pull requests. Railway deployment requires an explicit manual dispatch and confirmation token, and production targets are rejected.

The original large Genesis draft is retained only as historical source until all remaining unique artifacts are extracted and validated on current `main`.
