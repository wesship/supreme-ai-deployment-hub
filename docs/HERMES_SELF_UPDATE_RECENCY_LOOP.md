# Hermes Self-Update Recency Loop

## Purpose

Hermes must stay current with recent repository updates, deployments, schemas, and operational changes without becoming unsafe self-modifying software.

This loop gives Hermes a controlled way to refresh its operating context from the latest committed source of truth, validate compatibility, and create auditable tasks for any required follow-up work.

## Guardrails

Hermes may:

- Read recent commits, release notes, migrations, workflow changes, and deployment manifests.
- Update runtime memory, Knowledge Graph summaries, task metadata, and agent context.
- Open review tasks when new changes require operator approval.
- Mark stale context as deprecated.

Hermes must not:

- Directly rewrite production code without a GitHub PR/review path.
- Rotate secrets automatically without explicit operator approval.
- Deploy new infrastructure without passing validation gates.
- Bypass CI, policy-as-code, or security checks.

## Recency Inputs

Hermes should ingest these sources after each deployment or scheduled sync:

1. Recent Git commits on `main`.
2. Changed files under `.github/workflows/`.
3. Backend route changes under `backend/`, `server/`, `api/`, or `supabase/functions/`.
4. Database migrations under `supabase/migrations/`.
5. Agent manifests, registries, and Hermes task schemas.
6. Deployment documentation and runbooks.
7. Observability, health-check, and incident-response reports.

## Required State Transitions

For each recency sync, Hermes should create or update a sync task using this lifecycle:

```text
PENDING -> RUNNING -> COMPLETED
PENDING -> RUNNING -> MANUAL_REVIEW
PENDING -> RUNNING -> RETRY
```

A sync should move to `MANUAL_REVIEW` if it detects:

- Required secrets are missing.
- A migration exists but has not been applied.
- Workflow files changed but deployment has not been verified.
- Backend health is not HTTP 200.
- Hermes worker/callback/memory write-back is failing.

## Minimal Sync Contract

Every Hermes recency update should write a structured result:

```json
{
  "sync_type": "repo_recency",
  "source": "github_main",
  "commit_sha": "<latest-main-sha>",
  "changed_files": [],
  "detected_risks": [],
  "required_actions": [],
  "memory_updates": [],
  "kg_updates": [],
  "status": "COMPLETED|MANUAL_REVIEW|RETRY"
}
```

## Verification Checklist

After a new deployment, verify:

1. `/api/health` returns HTTP 200.
2. Secret manager initializes with `JWT_SECRET` and `ENCRYPTION_KEY`.
3. Hermes job intake accepts a test job.
4. Worker registration is visible.
5. Worker can claim a pending task.
6. Callback marks task completed.
7. Knowledge Graph or memory write-back records the result.
8. Agent-to-agent orchestration can read the updated context.

## Recommended Cadence

- On every production deployment.
- On every migration commit.
- On workflow/security changes.
- Daily scheduled recency refresh.
- Manual `workflow_dispatch` for emergency resync.

## Next Implementation Targets

1. Add a Hermes recency sync endpoint.
2. Add a safe CLI script that calls the endpoint after deployment.
3. Add a GitHub Actions workflow that verifies Hermes can ingest the latest commit.
4. Add dashboard status for last successful Hermes recency sync.
