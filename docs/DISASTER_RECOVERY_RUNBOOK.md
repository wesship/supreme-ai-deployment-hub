# D3VONN.IO Production Recovery and Operator Runbook

This is the canonical recovery runbook for the current D3VONN.IO production architecture. It replaces legacy EKS, Kubernetes, and pending-cutover assumptions.

## Canonical production architecture

| Layer | Production service | Canonical endpoint | Primary owner |
| --- | --- | --- | --- |
| Frontend | Vercel | `https://d3vonn.io` | D3VONN.IO operator |
| Application aliases | Vercel | `https://www.d3vonn.io`, `https://app.d3vonn.io` | D3VONN.IO operator |
| Backend | Railway | `https://api.d3vonn.io` | D3VONN.IO operator |
| Database, Auth, Storage | Supabase production | protected project | D3VONN.IO operator |
| Source and release controls | GitHub | `wesship/supreme-ai-deployment-hub` | repository owner |
| Error tracking | Sentry | configured server and frontend projects | D3VONN.IO operator |

Staging and production must remain isolated. Never reuse a production service-role key, database password, API token, or privileged test identity in staging.

## Recovery objectives

| Severity | Scenario | Target response | Target recovery |
| --- | --- | --- | --- |
| SEV-1 | Security compromise, destructive database incident, widespread outage | 15 minutes | restore safe service or maintenance mode within 4 hours |
| SEV-2 | Backend, authentication, or database degradation | 30 minutes | restore within 2 hours |
| SEV-3 | Partial feature, provider, contact delivery, or monitoring failure | 4 hours | repair or document fallback within 1 business day |
| SEV-4 | Non-blocking documentation, analytics, or cosmetic issue | 1 business day | planned release |

## First response

1. Record the incident start time, affected service, release SHA, and first observed symptom.
2. Check at least two independent signals before declaring a broad outage.
3. Freeze unrelated production changes.
4. Decide whether to roll back, apply a narrowly scoped repair, or enable maintenance messaging.
5. Keep credentials and user content out of tickets, logs, chat, screenshots, and workflow summaries.
6. Link all evidence to the incident or launch-certification issue.

## Production identity and health certification

Verify the branded endpoints instead of direct provider hostnames:

```bash
curl --fail --show-error https://d3vonn.io/
curl --fail --show-error https://api.d3vonn.io/health
curl --fail --show-error https://api.d3vonn.io/api/health
curl --fail --show-error https://api.d3vonn.io/ready
curl --fail --show-error https://api.d3vonn.io/health/live
curl --fail --show-error https://api.d3vonn.io/health/ready
curl --fail --show-error https://api.d3vonn.io/health/deployment
```

The deployment diagnostic may expose only non-secret environment, deployment ID, and Git commit metadata. It must never return credentials.

## Vercel recovery

### Verify

1. Open the canonical `supreme-ai-deployment-hub` Vercel project.
2. Confirm the current production deployment is `READY`.
3. Confirm `d3vonn.io`, `www.d3vonn.io`, and `app.d3vonn.io` point to the intended deployment.
4. Confirm the production frontend bundle uses `https://api.d3vonn.io` and not a direct Railway hostname.
5. Review build and runtime logs without copying secrets.

### Roll back

1. Select the last known-good production deployment.
2. Promote or redeploy that immutable deployment using Vercel's production rollback controls.
3. Verify all three aliases.
4. Run public desktop/mobile smoke checks and branded API checks.
5. Record the restored deployment ID and source SHA.

Do not change DNS merely to compensate for an application regression when an immutable deployment rollback is available.

## Railway recovery

### Verify

1. Open the `devonn-ai-backend` project and canonical production service.
2. Confirm the production environment, deployment status, and source commit.
3. Confirm `api.d3vonn.io` remains attached with valid TLS.
4. Inspect deployment and runtime logs for startup, dependency, or route failures.
5. Verify health, readiness, Redis, Supabase configuration, and route-family presence.

### Roll back

1. Redeploy the last known-good Railway deployment or source commit.
2. Do not copy staging variables into production.
3. Verify the branded API endpoints and deployment identity after rollback.
4. Confirm Vercel still calls only `api.d3vonn.io`.
5. Record the restored Railway deployment ID and Git SHA.

## Supabase migrations and recovery

### Governed migration procedure

1. Apply forward-only migrations in staging first.
2. Run schema readiness, RLS, access-boundary, advisor, and application smoke tests.
3. Use the protected GitHub `production` environment for production migration workflows.
4. Require explicit deployment approval.
5. Record target project reference, exact commit, migration versions, and sanitized output.
6. Rerun Supabase Security Advisor and application health checks.

Never manually apply only the last migration when prerequisite migration history is missing.

### Failed migration

1. Stop further migration attempts.
2. Capture the migration ledger and sanitized failure output.
3. Determine whether the failed statement committed partially.
4. Prefer a new forward-only repair migration.
5. Restore from backup only when data integrity cannot be safely repaired in place.
6. Re-certify RLS, grants, functions, triggers, indexes, and application readiness.

### Backup and restore

1. Confirm the production backup or point-in-time recovery capability available for the current Supabase plan.
2. Select a recovery point before the destructive event.
3. Restore through Supabase's supported recovery process.
4. Do not overwrite production connection variables until the restored database is validated.
5. Validate migration ledger, row counts, critical records, RLS, storage access, Auth, and server-side operations.
6. Update server-side consumers only after validation.
7. Run authenticated and public production canaries.
8. Record the recovery point, operator, duration, and residual data loss.

Backup availability and retention must be verified from the Supabase dashboard before every formal recovery drill; do not assume a fixed retention period.

## Authentication and credential incident handling

For suspected credential exposure:

1. Disable or rotate the compromised credential at its provider.
2. Update only its authorized server-side consumers.
3. Redeploy affected services.
4. Revoke sessions or tokens when supported and warranted.
5. Verify no privileged value is present in `VITE_*`, browser bundles, Git history, Actions output, or public logs.
6. Run Gitleaks, CodeQL, secret scanning, and authenticated boundary tests.
7. Record credential names and rotation times, never values.

High-priority credentials include Supabase service-role keys, database passwords, GitHub deployment tokens, Railway tokens, Resend keys, OpenAI/provider keys, JWT secrets, and Sentry auth tokens.

## DNS and TLS recovery

1. Resolve `d3vonn.io`, `www.d3vonn.io`, `app.d3vonn.io`, and `api.d3vonn.io` from more than one resolver or network.
2. Verify certificate hostname, validity, and chain.
3. Confirm Vercel owns frontend aliases and Railway owns the branded API alias.
4. Compare current DNS records with the approved inventory before editing.
5. Avoid emergency DNS changes for failures that can be addressed by deployment rollback.
6. After an authorized DNS change, verify propagation from multiple resolvers and rerun HTTPS checks.

A failure from one local DNS resolver is inconclusive until corroborated.

## Sentry and monitoring recovery

1. Confirm frontend and backend Sentry configuration by presence only.
2. Send a controlled non-sensitive test event.
3. Confirm the event appears in the expected project and environment.
4. Verify release SHA and environment tagging.
5. Check that alerts do not include credentials, tokens, or user content.
6. Correlate Sentry with Vercel, Railway, Supabase, and external HTTP evidence before declaring impact.

## Contact and provider failures

The contact endpoint must return truthful status:

- `202` only after the email provider accepts the message;
- `503` when mail configuration is absent;
- `502` when the provider rejects or fails.

Recovery requires both API acceptance and confirmation that a uniquely tagged message reached the configured owner mailbox.

For AI or rendering providers:

1. Disable or quarantine the failing adapter.
2. Preserve provider-neutral manual fallback where supported.
3. Prevent repeated paid retries.
4. Record provider status, bounded test cost, and affected jobs.
5. Resume only after a controlled canary succeeds.

## Maintenance mode

Use maintenance messaging only when a user-facing outage is confirmed and rollback cannot restore service quickly. Maintenance mode must not expose provider details, internal hostnames, or security information. Verify login and protected routes cannot enter an unsafe partial state.

## Incident closeout

An incident may close only after:

- public and authenticated canaries pass;
- production deployment identities are recorded;
- database integrity and security boundaries are verified when relevant;
- monitoring is stable across multiple signals;
- rollback or repair evidence is linked;
- follow-up owners and deadlines are assigned;
- Issue #599 is updated when launch readiness is affected.

## Recovery drills and maintenance

Perform a documented recovery review quarterly and after material architecture changes. Exercises should cover:

- Vercel rollback;
- Railway rollback;
- Supabase migration failure and restore decision-making;
- secret rotation;
- DNS/TLS verification;
- Sentry test-event delivery;
- contact-provider failure;
- operator communication and evidence capture.

A production data restore must not be performed merely for a drill unless explicitly approved and isolated. Use provider-supported non-destructive validation or a disposable environment whenever possible.
