# PRIMETIME Release Stack Runbook

## Purpose

This runbook gives operators a release-by-release view of the PRIMETIME production stack and the controls required before deployment.

## Release stack

| Release | PR | Layer | Purpose |
|---|---:|---|---|
| Release 1 | #434-#436 | CRM foundation | Workspace, people, leads, tasks, consent, suppression, activity, UI |
| Release 2 | #437 | Scheduling | Appointments, availability, attendees, reminders, no-show recovery |
| Release 3 | #440 | Communications | Templates, preferences, policy checks, communication timeline |
| Release 4 | #441 | AI assistance | Agents, outputs, action ledger, approvals, compliance findings, citations |
| Release 5 | #442 | Analytics | Dashboards, metrics, snapshots, governance observations |
| Release 6 | TBD | Hardening | QA gates, observability, deployment readiness, runbooks |

## Stack merge order

Merge in this order only:

1. #434 Release 1 schema
2. #435 Release 1 API
3. #436 Release 1 UI
4. #437 Release 2 scheduling
5. #440 Release 3 communications
6. #441 Release 4 AI assistance
7. #442 Release 5 analytics command center
8. Release 6 production hardening

## Pre-merge checks

Before each PR is merged:

- Confirm mergeability is true.
- Confirm required CI checks are understood.
- Confirm no accidental hard delete endpoints were introduced.
- Confirm no autonomous regulated endpoint was introduced.
- Confirm PR body matches implementation.
- Confirm static tests cover the release boundary.
- Confirm E2E seeded flow exists when UI is introduced.

## Post-merge checks

After each PR is merged:

- Rebase or retarget the next stacked PR if required.
- Confirm next PR is still mergeable.
- Confirm Vercel preview builds.
- Confirm security scan status.
- Confirm no unexpected migration conflict.

## Deployment runbook

### 1. Staging preparation

- Apply Supabase migrations in order.
- Configure staging environment variables.
- Deploy backend.
- Deploy frontend.
- Validate `/healthz`.
- Validate `/primetime` route.
- Validate all Release 1 through Release 5 routes.

### 2. Staging validation

- Run static tests.
- Run seeded E2E tests.
- Validate workspace creation or seeded workspace loading.
- Validate people/leads/tasks flow.
- Validate scheduling flow.
- Validate communication template/preferences flow.
- Validate AI assistance draft-first flow.
- Validate analytics snapshot flow.
- Validate no-send/no-quote/no-recommend-policy/no-delete boundaries.

### 3. Production preparation

- Confirm compliance sign-off.
- Confirm workspace admin sign-off.
- Confirm rollback plan.
- Confirm incident owner.
- Confirm branch-protection required checks.
- Confirm duplicate Snyk behavior is resolved or accepted.

### 4. Production deployment

- Apply migrations during approved window.
- Deploy backend.
- Deploy frontend.
- Validate health check.
- Validate route loading.
- Validate audit writes.
- Validate no outbound delivery integrations are accidentally enabled.

### 5. Post-deployment monitoring

Monitor:

- Backend errors
- Frontend deployment errors
- Supabase errors
- Audit event volume
- Release governance observations
- Communication policy blocks
- AI action blocked records
- No-show recovery task creation
- Analytics snapshot generation

## Rollback rules

Rollback must preserve regulated records.

Allowed rollback actions:

- Revert frontend deployment.
- Revert backend deployment.
- Disable newly mounted routes behind deployment controls if available.
- Pause worker/automation execution.

Restricted rollback actions:

- Do not delete regulated records.
- Do not truncate production audit tables.
- Do not remove consent records.
- Do not remove suppression records.
- Do not mutate communication or AI action history to hide failures.

## Incident response

When an incident occurs:

1. Stop affected execution path.
2. Preserve logs and audit records.
3. Create release governance observation.
4. Notify workspace admin.
5. Notify compliance reviewer if regulated data or client communication is involved.
6. Apply fix or rollback.
7. Record post-incident notes.

## Production owners

Required owner roles:

- Workspace admin
- Compliance reviewer
- Technical operator
- Security owner
- Release manager

## Completion standard

The PRIMETIME stack is production-ready when Releases 1 through 6 are merged, deployed to staging, validated through seeded workflows, compliance-reviewed, and approved for production launch.
