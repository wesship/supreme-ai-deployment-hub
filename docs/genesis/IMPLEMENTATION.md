# Genesis Platform Foundation

This implementation turns the Genesis architecture into a working D3VONN.IO vertical slice.

## Delivered

- Supabase/PostgreSQL schema for projects, members, canon, knowledge entities, relationships, assets, immutable versions, agents, goals, tasks, executions, checkpoints, workflows, reviews, approvals, render requests, provider jobs, outputs, events, outbox records, and idempotency.
- Row-Level Security and project membership checks.
- Transactional event/outbox function and atomic task-claim function.
- FastAPI `/api/genesis/*` surface authenticated by Supabase access tokens.
- Deterministic task/workflow state contracts.
- Project creation with a locked provenance law and project-scoped core agents.
- Bootstrap workflow that creates dependency-aware production tasks.
- Provider-neutral render routing, cost estimates, approval thresholds, and manual-provider fallback.
- Authenticated React Creator UI at `/genesis`, `/genesis/command-center`, and `/app/genesis`.
- Focused backend and CI verification.

## Rollout order

1. Merge the pull request after required checks pass.
2. Apply `supabase/migrations/20260726000000_genesis_platform_foundation.sql` to staging.
3. Verify the migration with a signed-in test user.
4. Deploy the backend so `/api/genesis/health` is available.
5. Deploy the frontend and sign in before opening `/genesis`.
6. Create a project and run **Bootstrap workflow**.
7. Configure external provider credentials server-side.
8. Re-run provider health and create a preview render request.
9. Apply to production only after staging API, RLS, workflow, and approval tests pass.

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

Provider keys remain server-side. They are never returned to the Creator UI or placed in agent prompts.

## API surface

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
```

## Current execution boundary

The vertical slice is complete through governed render planning and approval. External provider submission remains adapter/configuration dependent: when no provider credential is configured, the router uses `manual_gateway`, which packages the request without pretending that an automated external render occurred.

This boundary is intentional. It prevents model access from being mistaken for a validated production asset.

## Validation commands

```bash
pnpm typecheck
pnpm build
python -m compileall -q backend/genesis
python -m pytest backend/tests/test_genesis_platform.py -q
```

## Acceptance path

1. A signed-in user creates a project.
2. The system creates a locked provenance canon entry and five project-scoped agents.
3. Bootstrap creates a goal, workflow run, workflow steps, and dependency-aware tasks.
4. The user advances tasks through governed state transitions.
5. A preview render request receives a route and bounded cost estimate.
6. Requests above policy thresholds create an approval.
7. Approval updates the render request to `queued` or `rejected`.
8. Every consequential action emits a domain event and outbox record.

## Main synchronization

PR #580 was synchronized with `main` at commit `5e93073497345a5eb23f409cb2314968c151a53b`. The merged base includes the restored user-plan-log prerequisite and Hermes runtime-ledger migrations, tests, and incident documentation. Genesis remains isolated to its own ten migrations and must still complete staging API acceptance before production promotion.

## Next engineering increment

The next increment should add concrete provider adapters and workers for submission, webhook verification, quarantine ingestion, technical validation, asset-version registration, cost reconciliation, and workflow resumption. The schema and gateway contracts in this foundation are designed for that extension without changing the Creator UI contract.
