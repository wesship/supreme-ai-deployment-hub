# D3VONN.IO Production Runbook

**Version:** 3.0.0  
**Last Updated:** 2026-07-25

This runbook documents the active production architecture and the governed procedures for deploying, monitoring, and recovering D3VONN.IO.

## 1. Active production architecture

| Surface | Provider | Canonical target |
| --- | --- | --- |
| Public frontend | Vercel | `https://d3vonn.io` |
| Frontend aliases | Vercel | `https://www.d3vonn.io`, `https://app.d3vonn.io` |
| Backend API | Railway | `https://devonn-ai-api-production.up.railway.app` |
| Branded API | Railway custom domain, pending cutover | `https://api.d3vonn.io` |
| Database and Auth | Supabase | project configured through protected environment variables |
| Cache and queue | Railway-managed runtime connection | verified through `/health/ready` and operations health |

`api.d3vonn.io` must not be treated as canonical until its deployment marker, API-v1, operations, and deploy-probe routes match the Railway service. Track that cutover in Issue #540.

The legacy Kubernetes/EKS instructions previously stored in this file are not the active production path. VPS/Docker deployment remains a separate contingency path documented in `docs/D3VONN_PRODUCTION_CUTOVER_RUNBOOK.md`.

## 2. Standard deployment

### Frontend

A merge to `main` triggers the Git-connected Vercel production deployment.

Before merge, require:

- D3VONN Required PR Gate;
- CodeQL and Gitleaks;
- Security Hardening;
- tests and coverage;
- accessibility and Lighthouse;
- Verify Vercel Build;
- deployment and governance checks.

After merge:

1. Confirm the Vercel deployment reaches `READY`.
2. Confirm its Git commit SHA matches the intended merge commit.
3. Confirm aliases include `d3vonn.io`, `www.d3vonn.io`, and `app.d3vonn.io` without alias errors.
4. Verify the homepage and application route externally.

### Backend

A merge to `main` triggers the Railway deployment from the repository.

After merge, verify the direct canonical Railway target before relying on branded DNS:

```bash
API_BASE=https://devonn-ai-api-production.up.railway.app

curl --fail --silent --show-error "$API_BASE/health"
curl --fail --silent --show-error "$API_BASE/health/ready"
curl --fail --silent --show-error "$API_BASE/health/deployment"
curl --fail --silent --show-error "$API_BASE/api/v1/health"
curl --fail --silent --show-error "$API_BASE/api/v1/ops/health"
curl --fail --silent --show-error "$API_BASE/api/deploy/probe"
```

Required evidence:

- `/health` reports `status: ok`;
- `/health/ready` reports `status: ready`;
- `/health/deployment` identifies `backend.railway_app:app` and all required routers;
- `/api/v1/health` reports the API-v1 surface healthy;
- `/api/v1/ops/health` reports the component health payload;
- `/api/deploy/probe` reports the expected router registry and deployment marker.

## 3. Production health checks

| Endpoint | Expected result | Purpose |
| --- | --- | --- |
| `GET /health` | HTTP 200, `status: ok` | Liveness |
| `GET /health/ready` | HTTP 200, `status: ready` | Dependency readiness |
| `GET /health/deployment` | HTTP 200, Railway entrypoint and routers | Image and route certification |
| `GET /api/v1/health` | HTTP 200, API-v1 healthy | Versioned API health |
| `GET /api/v1/ops/health` | HTTP 200, component health | Operations health |
| `GET /api/deploy/probe` | HTTP 200, expected marker | Active deployment proof |

The scheduled operations workflow must monitor the direct Railway readiness endpoint until `api.d3vonn.io` is proven to serve the same application.

## 4. Monitoring and alert response

Monitor:

- Vercel deployment state and runtime errors;
- Railway application logs and restarts;
- API 5xx rate and latency;
- Redis reachability;
- Supabase availability and Security Advisor findings;
- scheduled operations workflow results;
- Sentry alerts once owner delivery is certified.

### High error rate

1. Confirm whether the error is frontend, backend, database, or dependency related.
2. Check Vercel runtime error clusters and the active production deployment.
3. Check Railway logs and all canonical health routes.
4. Check Supabase service health, migrations, and connection status.
5. Stop further merges while the incident is active.
6. Roll back the affected surface using the procedure below.
7. Record the incident, evidence, decision, and recovery result.

### Authentication or authorization incident

1. Verify Supabase Auth is reachable.
2. Run the credential-safe backend production audit.
3. Require missing, malformed, expired, or tampered tokens to return HTTP 401.
4. Require an ordinary user to receive HTTP 403 from OCC and admin routes.
5. Confirm privileged role evaluation uses protected metadata or the authoritative role store.
6. Rotate affected credentials only after identifying the exposure boundary.

## 5. Rollback

### Vercel frontend rollback

Vercel retains earlier READY production deployments as rollback candidates.

1. Identify the current deployment and the last known-good READY production deployment.
2. Confirm the candidate commit SHA and build state.
3. Promote the known-good deployment from the Vercel deployment controls.
4. Verify all production aliases point to the promoted deployment.
5. Test `/`, `/app`, `/login`, and one authenticated route.
6. Record the prior deployment ID, promoted deployment ID, time, and verification result.

Do not use a preview deployment as a rollback target unless it has been explicitly reviewed and promoted through the production controls.

### Railway backend rollback

1. Identify the active Railway deployment and the last known-good deployment.
2. Confirm the known-good commit passed the backend production audit.
3. Redeploy or roll back to that Railway deployment through the provider controls.
4. Verify all six canonical health and probe routes.
5. Run the credential-safe backend API certification.
6. Confirm the frontend still targets the intended backend.
7. Record deployment identifiers, commit SHA, and verification evidence.

### Database migration rollback

Prefer forward fixes. Roll back a migration only when:

- the migration has a tested reverse path;
- no irreversible user data transformation occurred;
- dependent application versions are understood;
- a backup or point-in-time recovery boundary is confirmed.

Use rollback-only transactions for certification fixtures and verify zero residue afterward.

## 6. Database migrations

Apply production DDL through a named Supabase migration, not ad hoc SQL.

Before applying:

1. Review the migration and static regression tests.
2. Confirm production schema readiness.
3. Check for destructive operations, lock duration, and dependency impact.
4. Confirm backup or point-in-time recovery coverage.

After applying:

1. List the migration and confirm its version is recorded.
2. Run the focused production verification.
3. Run Supabase Security Advisor.
4. Verify RLS, grants, function search paths, and service-role boundaries.
5. Record evidence in the launch or incident issue.

## 7. Secrets and key rotation

Production secrets belong in provider-managed protected environments:

- GitHub production environment secrets for governed workflows;
- Railway environment variables for backend-only secrets;
- Vercel environment variables for frontend build/runtime configuration;
- Supabase dashboard for Auth/API key rotation.

Never expose service-role, provider, mail, publishing, or private voice keys in browser-prefixed variables.

After rotation:

1. redeploy the affected service;
2. verify health and authentication;
3. revoke the previous credential;
4. confirm no workflow or runtime still references the old value;
5. record the rotation date and owner.

## 8. Backup and recovery

The launch gate requires evidence, not an assumption that managed backups exist.

Required certification:

1. Confirm the current Supabase backup or point-in-time recovery configuration in the provider dashboard.
2. Record the latest successful backup timestamp and retention policy.
3. Restore into a non-production project or isolated database.
4. Verify schema version, representative row counts, Auth dependencies, functions, and RLS policies.
5. Destroy the isolated restore after verification.
6. Record the restore duration and evidence without exposing user data.

Repository scripts may supplement provider backups but do not replace verification of the managed production recovery path.

## 9. Branded API cutover

Before switching monitoring or frontend traffic to `api.d3vonn.io`, require:

```bash
BRANDED=https://api.d3vonn.io

curl --fail --silent --show-error "$BRANDED/health"
curl --fail --silent --show-error "$BRANDED/health/ready"
curl --fail --silent --show-error "$BRANDED/health/deployment"
curl --fail --silent --show-error "$BRANDED/api/v1/health"
curl --fail --silent --show-error "$BRANDED/api/v1/ops/health"
curl --fail --silent --show-error "$BRANDED/api/deploy/probe"
```

All responses must match the canonical Railway application. Also verify:

- DNS resolves to the Railway custom-domain target;
- TLS is valid for `api.d3vonn.io`;
- CORS allows the three production frontend origins;
- no stale backend answers any route;
- scheduled monitoring has been switched only after certification.

## 10. Evidence and incident closure

Every production change or recovery must record:

- repository commit and PR;
- provider deployment identifiers;
- workflow run identifiers;
- health and functional test results;
- migrations applied;
- rollback decision and result, when applicable;
- remaining risks and owner-only actions.

Do not close an incident or launch blocker merely because a basic health route returns HTTP 200. Verify the route registry, application identity, authorization boundaries, and required user workflow.

## Related documents

- [Architecture Overview](./ARCHITECTURE.md)
- [Disaster Recovery Plan](./DISASTER_RECOVERY_PLAN.md)
- [D3VONN.IO Production Cutover Runbook](./D3VONN_PRODUCTION_CUTOVER_RUNBOOK.md)
- [Common Issues Runbook](./runbooks/common_issues.md)
