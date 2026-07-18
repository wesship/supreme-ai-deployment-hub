# PRIMETIME Deployment Execution Plan

## Purpose

This document defines the final execution plan for deploying the PRIMETIME insurance operating system stack after Releases 1 through 6 are reviewed, merged, and validated.

The deployment plan is intentionally gate-based. It does not bypass compliance, security, observability, or owner sign-off requirements.

## Release Stack Covered

| Release | Scope | PR |
| --- | --- | --- |
| Release 1 | CRM foundation, schema, API, UI | #434, #435, #436 |
| Release 2 | Scheduling and daily operations | #437 |
| Release 3 | Governed communications | #440 |
| Release 4 | AI Assistance foundation | #441 |
| Release 5 | Analytics and Executive Command Center | #442 |
| Release 6 | Production hardening and readiness gates | #444 |

## Deployment Principles

1. No release is deployed out of stack order.
2. No production deployment happens until migrations pass in staging.
3. No regulated workflow is enabled without consent, audit, template, and human-review controls.
4. No autonomous outbound sales calling, messaging, quote generation, policy recommendation, or application submission is enabled.
5. No sensitive export is enabled without authorization and audit.
6. Every migration, release, and rollback action must have an owner.
7. Staging validation must complete before production go/no-go.

## Pre-Deployment Requirements

### Repository Gates

- All stacked PRs reviewed in order.
- Merge order confirmed.
- Required checks documented.
- Duplicate `security/snyk (wesship8)` blocker acknowledged as external integration issue.
- Primary `security/snyk (wesship)` passing.
- Vercel deployment checks passing.
- Release 6 hardening artifacts merged.

### Environment Gates

- Staging Supabase project available.
- Production Supabase project available.
- Staging API environment available.
- Production API environment available.
- Staging frontend environment available.
- Production frontend environment available.
- Environment variables configured and verified.
- Service-role secrets restricted to backend only.
- Client only receives public anon keys.

### Compliance Gates

- Licensed-human-review boundary confirmed.
- Consent requirement confirmed for outbound communication workflows.
- Suppression records confirmed to block communications.
- AI action ledger confirmed for AI action tracking.
- No hard-delete behavior confirmed for regulated records.
- Communication templates require approval before production use.
- AI agent versions require approval before production use.

## Deployment Phases

### Phase 0 — Freeze and Confirm Stack

Owner: Release Manager

Actions:

1. Confirm all PRs are reviewed and mergeable.
2. Confirm no PR changes the base of a downstream stacked PR unexpectedly.
3. Confirm the merge order:
   - #434
   - #435
   - #436
   - #437
   - #440
   - #441
   - #442
   - #444
   - Deployment execution plan PR
4. Confirm no production secrets are present in repository files.
5. Confirm deployment window and rollback owner.

Exit criteria:

- Merge order approved.
- Deployment owner assigned.
- Rollback owner assigned.
- Compliance reviewer assigned.

### Phase 1 — Staging Migration Dry Run

Owner: Database Owner

Actions:

1. Create or refresh staging database snapshot.
2. Apply migrations in chronological order.
3. Confirm required tables exist.
4. Confirm RLS enabled for regulated and analytics tables.
5. Confirm seed data is safe and non-production-sensitive.
6. Confirm no destructive operation is present.
7. Run static schema tests.
8. Run API static tests.
9. Run seeded E2E flows.

Exit criteria:

- All migrations apply cleanly.
- Schema checks pass.
- RLS checks pass.
- Seeded E2E checks pass.

### Phase 2 — Staging Application Validation

Owner: QA Owner

Actions:

1. Deploy backend to staging.
2. Deploy frontend to staging.
3. Configure staging Supabase URL and keys.
4. Validate `/healthz`.
5. Validate PRIMETIME routes:
   - `/primetime`
   - `/primetime/release-1`
   - `/primetime/scheduling`
   - `/primetime/release-2`
   - `/primetime/communications`
   - `/primetime/release-3`
   - `/primetime/ai-assistance`
   - `/primetime/release-4`
   - `/primetime/executive-command-center`
   - `/primetime/release-5`
6. Validate backend prefixes:
   - `/primetime/v1/workspaces`
   - `/primetime/v1/appointments`
   - `/primetime/v1/message-templates`
   - `/primetime/v1/ai-agents`
   - `/primetime/v1/analytics/metric-definitions`
7. Confirm blocked endpoint fragments do not exist:
   - `/send`
   - `/quote`
   - `/recommend-policy`
   - `/submit-application`
8. Confirm no DELETE PRIMETIME endpoint is exposed.

Exit criteria:

- Staging UI routes render.
- Backend health check passes.
- Regulated blocked endpoints remain unavailable.
- No hard delete surface is exposed.

### Phase 3 — Governance Validation

Owner: Compliance Reviewer

Actions:

1. Validate communication template approval flow.
2. Validate communication consent checks.
3. Validate suppression blocking rules.
4. Validate AI agent version approval flow.
5. Validate AI action ledger writes.
6. Validate analytics only records snapshots and does not mutate CRM, scheduling, communication, or AI action records.
7. Validate audit events for create/update actions.
8. Validate role gates for representative, manager, compliance reviewer, workspace admin, platform admin, and auditor.

Exit criteria:

- Compliance reviewer signs off.
- No autonomous regulated workflow found.
- No unapproved template or unapproved AI agent version can be used as production-approved.

### Phase 4 — Production Readiness Review

Owner: Release Manager

Actions:

1. Review staging evidence.
2. Confirm environment variables.
3. Confirm database backup point.
4. Confirm rollback plan.
5. Confirm monitoring and alert routes.
6. Confirm incident contact path.
7. Confirm deployment window.
8. Confirm owner sign-offs.

Exit criteria:

- Go/no-go decision recorded.
- All required owners sign off.
- Rollback threshold agreed.

### Phase 5 — Production Deployment

Owner: Deployment Owner

Actions:

1. Create production database backup.
2. Apply migrations in order.
3. Deploy backend.
4. Deploy frontend.
5. Run production smoke tests.
6. Validate health endpoints.
7. Validate key PRIMETIME routes.
8. Validate no blocked endpoint is exposed.
9. Monitor logs and errors.
10. Record deployment completion.

Exit criteria:

- Production smoke tests pass.
- No critical errors observed.
- Compliance boundaries remain active.

### Phase 6 — Post-Deployment Observation

Owner: Operations Owner

Actions:

1. Monitor logs for elevated errors.
2. Monitor API latency.
3. Monitor failed requests.
4. Monitor audit event writes.
5. Monitor Supabase errors.
6. Review first-day PRIMETIME usage.
7. Record release governance observation if gaps appear.

Exit criteria:

- Observation window completed.
- No critical incident open.
- Known issues documented.

## Rollback Procedure

Rollback is triggered if any of these occur:

- Migration causes data integrity issue.
- Health check fails after deployment.
- Regulated blocked endpoint becomes available.
- DELETE endpoint appears for regulated PRIMETIME records.
- AI action bypasses audit.
- Communication bypasses consent or suppression.
- Critical production error rate exceeds owner-defined threshold.

Rollback actions:

1. Stop new deployments.
2. Disable affected frontend route if possible.
3. Roll backend to previous known-good deployment.
4. Revert frontend deployment if route-level issue exists.
5. Restore database only if approved by database owner and data-loss impact is understood.
6. Record incident as release governance observation.
7. Block redeploy until root cause is documented.

## Production Go/No-Go Gate

Production may proceed only when all are true:

- Release stack is merged in order.
- Staging migrations pass.
- Staging app validation passes.
- Governance validation passes.
- Required owners sign off.
- Rollback path is confirmed.
- Duplicate Snyk issue is documented or resolved.
- No blocked regulated endpoint exists.
- No hard-delete regulated record surface exists.

## Final Sign-Off Table

| Role | Name | Status | Timestamp |
| --- | --- | --- | --- |
| Release Manager | TBD | Pending | TBD |
| Database Owner | TBD | Pending | TBD |
| Backend Owner | TBD | Pending | TBD |
| Frontend Owner | TBD | Pending | TBD |
| Compliance Reviewer | TBD | Pending | TBD |
| Security Owner | TBD | Pending | TBD |
| Operations Owner | TBD | Pending | TBD |
| Business Owner | TBD | Pending | TBD |

## Non-Negotiable Production Boundaries

- No communication without consent check.
- No AI execution without audit.
- No regulated recommendation without licensed human review.
- No unapproved template in production.
- No unapproved AI agent version in production.
- No autonomous outbound sales calling.
- No quote generation endpoint.
- No policy recommendation endpoint.
- No application submission endpoint.
- No hard delete for regulated records.
- No sensitive export without authorization.
- No agent bypassing compliance gates.
