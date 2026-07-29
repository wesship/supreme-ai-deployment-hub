# D3VONN.IO Production Recovery and Operator Runbook

This is the canonical recovery runbook for the current D3VONN.IO production architecture. It replaces legacy EKS, Kubernetes, AWS-region failover, and pre-branded-API assumptions.

Related certification tracks: #599 launch readiness, #588 Supabase security, #589 provider-secret inventory, #600 production operations, and #608 recovery readiness.

## 1. Certified production architecture

| Layer | Canonical service | Primary verification |
| :--- | :--- | :--- |
| Public web | Vercel production project `supreme-ai-deployment-hub` | `https://d3vonn.io` |
| Branded domains | `d3vonn.io`, `www.d3vonn.io`, `app.d3vonn.io` | Vercel domain assignments and HTTP/TLS checks |
| Backend | Railway production service `devonn-ai-api` | `https://api.d3vonn.io` |
| Database, auth, storage | Supabase production | migration ledger, health and advisor checks |
| Cache/runtime dependency | Redis exposed through backend health | `/health/deep` or current deep-health route |
| Error tracking | Sentry | controlled test event and issue receipt |
| Source and release evidence | GitHub `wesship/supreme-ai-deployment-hub` | exact commit and workflow run links |

Staging must remain isolated from production. Never use production service-role, database-password, provider, or user credentials in staging.

## 2. Ownership and authorization

- **Incident commander and rollback owner:** Wesley Little (`wesship`) until a delegated operator is recorded.
- **Frontend rollback:** Vercel project owner or administrator.
- **Backend rollback:** Railway project owner or administrator.
- **Database recovery:** Supabase project owner or administrator.
- **DNS/TLS:** domain and DNS account owner.
- **Security incident:** incident commander plus the owner of the affected provider account.

Only the incident commander may authorize production rollback, destructive database recovery, DNS changes, credential rotation, or provider shutdown. Record the authorizer, timestamp, exact commit/deployment, reason, and verification evidence in the related GitHub incident or launch issue.

## 3. Severity and response targets

| Severity | Example | Target response | Target recovery |
| :--- | :--- | :--- | :--- |
| SEV-1 | Public site and API unavailable, confirmed data exposure, destructive data loss | 15 minutes | 1 hour or controlled degraded mode |
| SEV-2 | Login failure, core API failure, contact delivery failure, serious tenant-isolation concern | 30 minutes | 4 hours |
| SEV-3 | Partial feature failure, performance regression, non-critical provider outage | 4 hours | 1 business day |
| SEV-4 | Cosmetic defect, documentation drift, low-risk warning | 1 business day | Planned release |

Never declare an outage from a single DNS resolver, probe, region, browser, or runner. Confirm with at least two independent paths when possible.

## 4. First-response checklist

1. Stop new production changes and identify the exact deployed frontend and backend commits.
2. Capture UTC time, affected routes, status codes, request IDs, screenshots, and sanitized logs.
3. Verify independently:
   - `https://d3vonn.io`
   - `https://api.d3vonn.io/health`
   - `https://api.d3vonn.io/api/health`
   - `https://api.d3vonn.io/ready`
   - `https://api.d3vonn.io/api/v1/health`
   - the current deep-health endpoint
4. Check Vercel deployment state, Railway deployment identity, Supabase status, Redis state, and Sentry.
5. Decide whether to repair forward, roll back one service, enter degraded mode, or perform database recovery.
6. Record every action in the incident issue. Never paste secrets, tokens, authorization headers, full user content, or unredacted environment dumps.

## 5. Frontend recovery — Vercel

### Verify

- Confirm the production deployment is `READY`.
- Confirm the three branded aliases point to the intended deployment.
- Confirm the production build uses `https://api.d3vonn.io` and does not contain a direct Railway production fallback.
- Test homepage, login, dashboard, Film, legal/support, and one authenticated protected route when credentials are available.

### Roll back

1. Select the most recent certified production deployment associated with a green exact-head commit.
2. Promote or redeploy that deployment to production through Vercel.
3. Reconfirm branded aliases, TLS, CSP/HSTS, public navigation, and API origin behavior.
4. Record the old and new deployment IDs and commits.

Do not change DNS merely to fix a bad application deployment.

## 6. Backend recovery — Railway

### Verify

- Confirm the custom domain and valid TLS for `api.d3vonn.io`.
- Verify health, readiness, deep dependency health, and `/health/deployment` identity.
- Confirm `RAILWAY_ENVIRONMENT_NAME=production` is reflected accurately.
- Compare the reported Railway commit with the intended `main` commit.
- Check runtime errors without exposing environment-variable values.

### Roll back

1. Redeploy the last certified Railway production deployment or deploy the last certified backend commit.
2. Do not copy staging variables into production or production variables into staging.
3. Re-run all branded health endpoints and read-only API certification.
4. Verify Supabase and Redis dependencies before declaring recovery.
5. Record Railway deployment ID, commit, operator, and verification results.

If the API is unsafe but the frontend remains available, use an approved maintenance/degraded-mode path rather than redirecting clients to an unbranded Railway origin.

## 7. Supabase migration, backup and restore

### Migration control

- Production DDL must use the protected production migration workflow and production-environment approval.
- Review the migration preview and target project reference before approval.
- Apply forward-only migrations. Do not edit or reorder migrations already recorded in the production ledger.
- After application, verify the migration ledger, critical RPCs, RLS policies, grants, Security Advisor, and application health.

### Failed migration

1. Stop further migrations.
2. Capture the failed version, sanitized error, target project, and workflow run.
3. Determine whether the transaction rolled back fully.
4. Prefer a new corrective forward migration.
5. Use a destructive rollback only when explicitly authorized and tested against a branch or restored copy.

### Backup and restore

1. Identify the recovery point before the incident and confirm the expected recovery-point loss.
2. Use Supabase-supported backup or point-in-time recovery for the production project.
3. Restore to an isolated target first when the platform permits.
4. Validate schema versions, row counts, auth, storage references, RLS, RPCs, and representative tenant data.
5. Repoint application dependencies only after approval and validation.
6. Re-run authenticated smoke tests and security certification.
7. Preserve evidence without exporting user data into GitHub artifacts.

A restore drill is not complete until the restored environment is queried, authenticated, and compared with expected migration and security state.

## 8. Credential or account compromise

1. Disable or revoke the affected credential at its issuing provider.
2. Rotate the credential in every authorized consumer: Railway, Vercel, GitHub environments, Supabase secrets, or approved operator systems.
3. Never place service-role keys, database passwords, private provider keys, or privileged tokens in `VITE_*` variables.
4. Redeploy only the affected services.
5. Review GitHub secret scanning, Gitleaks, provider audit logs, Railway/Vercel logs, Supabase logs, and Sentry.
6. Invalidate sessions or JWT-related material only with an explicit user-impact plan.
7. Record presence and rotation evidence, never the secret value.

Priority credentials include Supabase service-role and database credentials, OpenAI/provider keys, Resend credentials, Sentry tokens, Railway tokens, Vercel tokens, OAuth secrets, and JWT signing material.

## 9. DNS and TLS recovery

- Verify authoritative DNS separately from local resolver caches.
- Confirm `d3vonn.io` and subdomain records match the approved Vercel/Railway targets.
- Confirm certificate validity, hostname coverage, and renewal state.
- Do not change records based on one failed resolver.
- Before DNS rollback, capture the current records and reduce TTL only when a planned change requires it.
- After change, verify from multiple public resolvers and direct HTTPS clients.

## 10. Sentry and monitoring validation

- Send a controlled, non-sensitive test event through the approved application path.
- Confirm receipt, environment label, release/commit identity, and source map behavior.
- Never include credentials, authorization headers, full form submissions, or private prompts in test events.
- Treat monitoring disagreement as an investigation trigger, not automatic outage proof.
- Validate public health with at least two independent sources before escalation.

## 11. Contact and provider failures

For the contact form, distinguish application acceptance from mailbox delivery:

- HTTP 503 means required mail configuration is absent.
- HTTP 502 means the provider rejected or failed the request.
- HTTP 202 with `status: sent` proves provider acceptance only.
- The launch gate requires confirmation that the uniquely tagged message reached the configured owner mailbox.

For AI providers, switch to approved provider-neutral fallback behavior when possible. Do not bypass quotas, use personal browser sessions as API credentials, or enable unapproved paid execution during incident response.

## 12. Recovery verification gate

Before closing an incident or declaring recovery, confirm:

- exact frontend and backend commits are recorded;
- Vercel and Railway deployments are healthy and correctly identified;
- public and authenticated critical paths pass;
- Supabase and Redis dependencies are healthy;
- RLS, tenant isolation, and Security Advisor state are acceptable;
- contact/provider behavior is truthful;
- Sentry received the controlled validation event;
- no privileged secret appears in client bundles or logs;
- rollback or repair evidence is linked to the incident and #599 when launch-related.

## 13. Exercise schedule and evidence

- Run a quarterly tabletop exercise.
- Run a Vercel rollback drill and Railway rollback drill at least twice per year.
- Run a Supabase restore validation at least annually and after material database architecture changes.
- Review this runbook after every SEV-1/SEV-2 incident and every hosting, domain, auth, or database migration change.
- Store sanitized drill evidence in GitHub issues or approved workflow artifacts. Never store database exports or credentials in the repository.
