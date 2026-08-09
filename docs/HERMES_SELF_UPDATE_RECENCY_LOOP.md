# Hermes Self-Update Recency Loop

## Purpose

Hermes must stay current with recent repository updates, deployments, schemas, and operational changes without becoming unsafe self-modifying software.

This loop gives Hermes a controlled way to refresh its operating context from the latest committed source of truth, validate compatibility, and create auditable tasks for any required follow-up work.

## Canonical context

`MASTER_CONTEXT.md` is the compact canonical repository context for Hermes and DKOS. Load it before subsystem summaries during a repo-recency sync. It does not replace direct source, migrations, manifests, or runtime telemetry.

Truth order:

1. Current `main` source/migrations/manifests.
2. Runtime health and telemetry for deployed-state claims.
3. `MASTER_CONTEXT.md` and governed runbooks as summaries.
4. Draft/unmerged PRs as pending proposals only.

## Guardrails

Hermes may:

- Read recent commits, release notes, migrations, workflow changes, deployment manifests, and `MASTER_CONTEXT.md`.
- Update runtime memory, Knowledge Graph summaries, task metadata, and agent context.
- Open review tasks when new changes require operator approval.
- Mark stale context as deprecated.

Hermes must not:

- Directly rewrite production code without a GitHub PR/review path.
- Rotate secrets automatically without explicit operator approval.
- Deploy new infrastructure without passing validation gates.
- Bypass CI, policy-as-code, security checks, RLS, or approval controls.
- Treat a draft/unmerged PR as current production truth.
- Store secret values in memory summaries, KG artifacts, prompts, logs, or repository knowledge files.

## Recency Inputs

Hermes should ingest these sources after each deployment or scheduled sync:

1. `MASTER_CONTEXT.md`.
2. Recent Git commits on `main`.
3. Changed files under `.github/workflows/`.
4. Backend route changes under `backend/`, `server/`, `api/`, or `supabase/functions/`.
5. Database migrations under `supabase/migrations/`.
6. Agent manifests, registries, and Hermes task schemas.
7. AI Films canon, provider manifests, and ingestion manifests when changed.
8. Deployment documentation and runbooks.
9. Observability, health-check, and incident-response reports.

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
- DKOS artifacts do not contain the latest canonical-context revision.
- An AI Films manifest/canon change is not reflected in the runtime knowledge index.
- Repository and runtime evidence disagree about deployed state.

## Minimal Sync Contract

Every Hermes recency update should write a structured result:

```json
{
  "sync_type": "repo_recency",
  "source": "github_main",
  "commit_sha": "<latest-main-sha>",
  "canonical_context_version": "<MASTER_CONTEXT version>",
  "canonical_context_sha256": "<MASTER_CONTEXT SHA-256>",
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
2. Deployed commit/revision matches the expected release.
3. Secret manager initializes with required secret **presence** without logging values.
4. Hermes job intake accepts a test job.
5. Worker registration is visible.
6. Worker can claim a pending task.
7. Callback marks task completed.
8. Knowledge Graph or memory write-back records the result.
9. DKOS reports ready and /api/knowledge/status exposes the expected canonical-context version and SHA-256.
10. Agent-to-agent orchestration can retrieve the updated context.
11. If AI Films changed, verify worker state, asset metadata, and TwelveLabs item readiness before declaring the media pipeline healthy.

## Recommended Cadence

- On every production deployment.
- On every migration commit.
- On canonical-context, manifest, canon, workflow, or security changes.
- Daily scheduled recency refresh.
- Manual `workflow_dispatch` for emergency resync.

## Implemented Runtime Behavior

- The Knowledge API loads the deployed `MASTER_CONTEXT.md` as the canonical first document.
- When generated DKOS artifacts exist, the deployed canonical document replaces any stale indexed copy.
- When the generated index is unavailable, the API remains ready in `canonical_fallback` mode.
- `/api/knowledge/status` exposes the mode, deployed commit SHA, canonical version, and canonical SHA-256.
- Search includes canonical document content, and context assembly always prioritizes it.
- The recency workflow runs for canonical-context and `llms.txt` changes and emits the exact version and SHA-256 in its artifact.
- A post-deploy verifier retries the live Knowledge API, compares version, SHA-256, and deployed commit, and uploads an auditable report.

## Next Implementation Targets

1. Add a Hermes acknowledgement/write-back endpoint with auditable task state.
2. Add dashboard status for the last successful sync, canonical SHA-256, and indexed commit SHA.
3. Persist verified recency results so Hermes and operators share the same last-known-good state.
