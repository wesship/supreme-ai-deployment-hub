# D3VONN.IO Production Runbook

**Version:** 3.1.0  
**Last Updated:** 2026-08-11

This runbook documents the active production architecture and the governed procedures for deploying, monitoring, and recovering D3VONN.IO.

## 1. Active production architecture

| Surface | Provider | Canonical target |
| --- | --- | --- |
| Public frontend | Vercel | `https://www.d3vonn.io` |
| Apex frontend | Vercel redirect | `https://d3vonn.io` → `https://www.d3vonn.io` |
| App alias | Vercel redirect | `https://app.d3vonn.io` → application route |
| Backend API | Railway | `https://devonn-ai-api-production.up.railway.app` |
| Branded API | Railway custom domain, pending full certification | `https://api.d3vonn.io` |
| Database and Auth | Supabase | project configured through protected environment variables |
| MCP Edge proxies | Supabase Edge Functions | `mcp-gateway`, `mcp-stdio-proxy` |
| MCP/worker contingency runtime | Hostinger VPS / Docker | owner-operated deployment |
| Cache and queue | Railway-managed runtime connection | verified through readiness and operations health |

`api.d3vonn.io` must not be treated as canonical until its deployment marker, readiness, API-v1, operations, and deploy-probe routes match the Railway service.

The legacy Kubernetes/EKS instructions previously stored in this file are not the active production path. VPS/Docker deployment is an operations/contingency path rather than the primary frontend/backend deployment model.

## 2. Standard deployment

### Frontend

A merge to `main` triggers the Git-connected Vercel production deployment.

Before merge, require the repository's applicable security and quality gates, including:

- D3VONN Required PR Gate;
- CodeQL and Gitleaks;
- Security Hardening;
- tests and coverage;
- accessibility and Lighthouse;
- Verify Vercel Build;
- deployment, governance, signing, and trusted-runner checks where applicable.

After merge:

1. Confirm the Vercel deployment reaches `READY`.
2. Confirm its Git commit SHA matches the intended merge commit.
3. Confirm production aliases have no assignment errors.
4. Verify `https://www.d3vonn.io/` and core public routes externally.
5. Verify `https://d3vonn.io` redirects to the canonical `www` host.
6. Verify protected application routes still enforce authentication.
7. Verify the machine-readable web health route returns JSON, not the SPA fallback.

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

### Frontend

| Endpoint | Expected result | Purpose |
| --- | --- | --- |
| `GET https://www.d3vonn.io/` | HTTP 200 HTML | Public frontend availability |
| `GET https://www.d3vonn.io/health` | HTTP 200 JSON | Frontend machine health probe |
| `GET https://www.d3vonn.io/pricing` | HTTP 200 HTML | Static public route verification |

### Backend

| Endpoint | Expected result | Purpose |
| --- | --- | --- |
| `GET /health` | HTTP 200, `status: ok` | Liveness |
| `GET /health/ready` | HTTP 200, `status: ready` | Dependency readiness |
| `GET /health/deployment` | HTTP 200, Railway entrypoint and routers | Image and route certification |
| `GET /api/v1/health` | HTTP 200, API-v1 healthy | Versioned API health |
| `GET /api/v1/ops/health` | HTTP 200, component health | Operations health |
| `GET /api/deploy/probe` | HTTP 200, expected marker | Active deployment proof |

Scheduled operations monitoring should use the direct Railway readiness endpoint until `api.d3vonn.io` is fully certified to serve the same application.

## 4. Monitoring and alert response

Monitor:

- Vercel deployment state and runtime error clusters;
- Railway application logs and restarts;
- API 5xx rate and latency;
- Redis reachability;
- Supabase availability, migration state, and Security Advisor findings;
- scheduled operations workflow results;
- Sentry alerts once owner delivery is certified;
- Hostinger VPS health for owner-operated gateway and worker services.

### High error rate

1. Confirm whether the error is frontend, backend, database, queue/cache, VPS, or dependency related.
2. Check Vercel runtime errors and the active production deployment.
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
3. Promote the known-good deployment through Vercel production controls.
4. Verify all production aliases point to the promoted deployment.
5. Test `/`, `/health`, `/app`, `/login`, and one authenticated route.
6. Record the prior deployment ID, promoted deployment ID, time, and verification result.

Do not use a preview deployment as a rollback target unless it has been explicitly reviewed and promoted through production controls.

### Railway backend rollback

1. Identify the active Railway deployment and the last known-good deployment.
2. Confirm the known-good commit passed the backend production audit.
3. Redeploy or roll back to that Railway deployment through Railway controls.
4. Verify all canonical health and probe routes.
5. Run the credential-safe backend API certification.
6. Confirm the frontend still targets the intended backend.
7. Record deployment identifiers, commit SHA, and verification evidence.

### Hostinger VPS rollback

For owner-operated Docker services such as MCP gateways or edge workers:

1. Identify the active repository commit and Docker Compose configuration.
2. Confirm the last known-good image/commit and retained secret names.
3. Redeploy the known-good commit through the owner-only deployment wrapper.
4. Verify containers are healthy and sensitive ports remain internal-only.
5. Run authentication and persistence smoke tests.
6. Record the VPS deployment commit and health evidence.

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

1. Review the migration and focused regression tests.
2. Confirm production schema readiness.
3. Check for destructive operations, lock duration, and dependency impact.
4. Confirm backup or point-in-time recovery coverage.
5. Require the exact migration head to pass repository migration/security gates.

After applying:

1. Confirm the migration version is recorded.
2. Run focused production verification.
3. Run Supabase Security Advisor and Performance Advisor.
4. Verify RLS, grants, function search paths, and service-role boundaries.
5. Record evidence in the launch or incident issue.

## 7. Secrets and key rotation

Production secrets belong in provider-managed protected environments:

- GitHub production environment secrets for governed workflows;
- Railway environment variables for backend-only secrets;
- Vercel environment variables for frontend/serverless configuration;
- Supabase project secrets for Edge Function upstreams and provider configuration;
- Hostinger/VPS secret stores or protected environment files for owner-only services.

Never expose service-role, provider, mail, publishing, Railway, MCP upstream, or private voice keys in browser-prefixed variables.

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

## 9. MCP production activation

The browser must never choose an arbitrary upstream gateway URL.

Required production chain:

1. `/mcp` requires an authenticated user.
2. Browser traffic targets the JWT-protected Supabase Edge Functions only.
3. `mcp-gateway` reads `MCP_GATEWAY_URL` from protected Supabase project secrets.
4. `mcp-stdio-proxy` reads `MCP_STDIO_GATEWAY_URL` from protected Supabase project secrets.
5. The upstream Hostinger/Docker gateway accepts only the expected authenticated/proxied requests.
6. Production browser origins are explicitly allowlisted.
7. A failed upstream connection must not be displayed as connected.

Do not activate MCP upstream routing by adding a browser-visible gateway URL.

## 10. Branded API cutover

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
- CORS allows the production frontend origins;
- no stale backend answers any route;
- scheduled monitoring is switched only after certification.

## 11. Evidence and incident closure

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
