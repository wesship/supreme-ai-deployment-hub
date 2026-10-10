# Security Policy

D3VONN.IO is an AI Business Operating System for supervised agent execution, workflow automation, persistent knowledge, and command-center visibility.

## Supported branches

Currently supported:

| Branch | Purpose | Supported |
| --- | --- | --- |
| `main` | Production | Yes |
| `develop` | Staging, when active | Yes |
| Legacy branches | Historical work | No |

## Reporting a vulnerability

Please do **not** open a public issue for security concerns.

Preferred reporting channels:

1. GitHub Security Advisories: use the repository Security tab and choose “Report a vulnerability.”
2. Email: security@d3vonn.io

Please include:

- Affected URL, endpoint, component, or package
- Reproduction steps
- Expected impact
- Screenshots, logs, or proof-of-concept details when safe to share
- Suggested remediation, if known
- Your preferred contact information

## Scope

In scope:

- Public D3VONN.IO web surfaces
- Authentication and authorization issues
- Server-side API boundary issues
- Data exposure, RAG/memory exposure, or agent-run leakage
- Security header or routing misconfiguration
- Dependency vulnerabilities with practical exploit paths
- Supabase, FastAPI, Vite, VPS, Vercel, and GitHub Actions misconfigurations

Out of scope:

- Social engineering
- Physical attacks
- Denial-of-service load testing without written permission
- Automated scans that create noise or degrade service
- Issues requiring compromised third-party accounts
- Theoretical findings without a practical exploit path

## Secret handling and incident response

Treat any API key, token, password, private key, service-role key, webhook secret, or connection string pasted into chat, logs, screenshots, tickets, or public repositories as compromised.

Required response:

1. Revoke or rotate the exposed credential in the provider dashboard.
2. Review provider audit logs for unauthorized use.
3. Replace the credential only in the VPS production secret file.
4. Restart the affected services.
5. Verify readiness and provider connectivity.
6. Remove leaked material from public locations where possible, but do not assume deletion makes the old credential safe.

Never commit real secrets. Repository examples must contain placeholders only.

### VPS-only production secret setup

Create or update the production environment file directly on the VPS:

```bash
cd /opt/supreme-ai-deployment-hub
install -m 600 /dev/null deploy/vps/env/.env.production
nano deploy/vps/env/.env.production
chmod 600 deploy/vps/env/.env.production
chown root:root deploy/vps/env/.env.production
```

Use placeholder names in documentation and replace them only inside the VPS file:

```dotenv
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_ROLE_KEY=replace-on-vps
OPENAI_API_KEY=replace-on-vps
ANTHROPIC_API_KEY=replace-on-vps
GOOGLE_AI_API_KEY=replace-on-vps
PINECONE_API_KEY=replace-on-vps
JWT_SECRET=replace-with-a-long-random-value
```

Confirm the file is ignored by Git before adding secrets:

```bash
git check-ignore -v deploy/vps/env/.env.production
```

## Production rebuild and readiness validation

Run after merging deployment, Docker, dependency, or environment changes:

```bash
cd /opt/supreme-ai-deployment-hub
git pull --ff-only

docker compose \
  --env-file deploy/vps/env/.env.production \
  -f deploy/vps/docker-compose.yml \
  config

docker compose \
  --env-file deploy/vps/env/.env.production \
  -f deploy/vps/docker-compose.yml \
  up -d --build
```

### Post-rebuild validation checklist

#### Container health

```bash
docker compose \
  --env-file deploy/vps/env/.env.production \
  -f deploy/vps/docker-compose.yml \
  ps

docker ps --format 'table {{.Names}}\t{{.Status}}\t{{.Ports}}'
```

Expected:

- Nginx, backend, Redis, Hermes, Celery worker, Celery beat, and Certbot are running as designed.
- No restart loops.
- No unexpected host ports.
- Placeholder agent containers are absent from production.

#### Frontend and API

```bash
curl -fsS https://d3vonn.io/ >/dev/null
curl -fsS https://app.d3vonn.io/ >/dev/null
curl -fsS https://api.d3vonn.io/health
curl -fsS https://api.d3vonn.io/health/ready
```

Expected readiness behavior:

- HTTP 200 when the API is healthy and critical dependencies are reachable.
- `api` reports healthy.
- `redis` reports reachable.
- Supabase and required model/vector providers report configured.
- HTTP 503 is acceptable only while a critical dependency is intentionally unavailable and must be investigated before declaring production ready.

#### Authentication

Verify:

- A valid user can sign in.
- Protected routes reject anonymous requests.
- Admin-only routes reject non-admin users.
- Logout invalidates the active session.
- No access token is written to server logs or browser-visible error output.

#### RAG and knowledge retrieval

Verify:

- A known test document can be ingested.
- Retrieval returns content from the intended tenant or workspace only.
- Responses include expected citations or source metadata.
- Empty and malformed queries fail safely.
- Provider failures do not expose credentials, raw prompts, or stack traces.

#### Hermes and worker jobs

Verify:

- Hermes accepts a controlled test task.
- The task transitions through expected states such as `PENDING`, `RUNNING`, and `COMPLETED`.
- Celery receives and completes a test job.
- Failed jobs retry according to policy and eventually enter a visible failure or manual-review state.
- Duplicate task delivery does not create duplicate irreversible actions.

#### Service health and logs

```bash
docker compose \
  --env-file deploy/vps/env/.env.production \
  -f deploy/vps/docker-compose.yml \
  logs --tail=200 backend hermes celery-worker celery-beat nginx redis
```

Confirm:

- No Python tracebacks, unhandled promise rejections, repeated connection failures, or restart loops.
- Logs do not contain API keys, bearer tokens, cookies, passwords, private prompts, service-role keys, or full connection strings.
- Errors use request or correlation IDs where available.

## CORS verification

Trusted origins must receive CORS permission:

```bash
curl -i \
  -H 'Origin: https://d3vonn.io' \
  https://api.d3vonn.io/health/ready

curl -i \
  -H 'Origin: https://www.d3vonn.io' \
  https://api.d3vonn.io/health/ready

curl -i \
  -H 'Origin: https://app.d3vonn.io' \
  https://api.d3vonn.io/health/ready
```

Expected: the matching origin is returned in `Access-Control-Allow-Origin`.

Untrusted origins must not receive CORS permission:

```bash
curl -i \
  -H 'Origin: https://evil.example' \
  https://api.d3vonn.io/health/ready
```

Expected: no `Access-Control-Allow-Origin` header for the untrusted origin.

## Production hardening audit checklist

### Network and host

- Firewall permits only required public ports, normally 80 and 443, plus restricted SSH access.
- Redis, databases, backend service ports, metrics endpoints, and admin tools are not publicly exposed.
- SSH password authentication is disabled after key access is confirmed.
- Direct root login is disabled or tightly controlled through an approved administrative process.
- Operating-system security updates are installed and reboot requirements are tracked.
- Time synchronization is enabled.

### HTTP and application security

- HTTPS is enforced.
- HSTS, CSP, `X-Content-Type-Options`, clickjacking protection, and a restrictive referrer policy are configured.
- CSP does not include unnecessary wildcards or unsafe directives.
- API rate limits exist for authentication, expensive AI calls, uploads, webhooks, and public endpoints.
- Request body and upload size limits are enforced.
- Safe error responses do not expose stack traces, filesystem paths, SQL, prompts, or provider responses.
- CORS is limited to approved D3VONN.IO origins.

### Containers

- Containers run as non-root where practical.
- No service uses `privileged: true` without documented approval.
- Linux capabilities are dropped unless required.
- Filesystems are read-only where practical, with explicit writable mounts.
- Docker socket access is not granted to application containers.
- Resource limits and health checks exist for long-running services.
- Production compose contains only real, required services.

### Data, backups, and recovery

- Database and persistent-volume backups are automated.
- Backup retention and encryption are documented.
- Restore procedures are tested, not merely assumed.
- Supabase recovery settings and point-in-time recovery are reviewed.
- Redis persistence and recovery expectations are documented.
- RPO and RTO targets are defined for critical services.

### Dependencies and supply chain

- GitHub dependency review, Dependabot, CodeQL, Node, Python, and container scans run on the canonical CI lane.
- Lockfiles are committed and production installs use frozen lockfiles.
- GitHub Actions are pinned to trusted versions or commit SHAs.
- High and critical vulnerabilities are triaged before release.
- Build provenance and image tags are traceable to a Git commit.

### Observability and operations

- Centralized error reporting is enabled without leaking sensitive data.
- Health, readiness, latency, error rate, queue depth, and worker failure metrics are monitored.
- Alerts identify certificate expiration, disk pressure, memory pressure, repeated restarts, API errors, and queue backlogs.
- Logs have retention limits and access controls.
- Incident response, rollback, and escalation procedures are documented.

## Current security posture

The platform is being built around:

- HTTPS-only production delivery
- Server-side API proxy boundaries
- Private provider-key handling
- Protected authenticated routes
- CSP and HSTS hardening path
- Auditability for agent runs, task checkpoints, and supervised approvals
- Enterprise roadmap for SSO, RBAC, SCIM, audit-log exports, and SOC 2 readiness

## Response process

1. We aim to acknowledge valid reports promptly.
2. We triage severity and business impact.
3. We prepare, test, and deploy a fix.
4. We notify the reporter when the issue is remediated.
5. We credit researchers when appropriate and requested.

## Automated scanning

The repository uses or is designed to support automated security scanning across:

- GitHub Dependabot
- GitHub code scanning / CodeQL
- Node.js dependency checks
- Python dependency checks
- Infrastructure configuration checks

## Responsible disclosure

Do not publicly disclose vulnerabilities until the team has had a reasonable opportunity to investigate and remediate.
