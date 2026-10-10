# D3VONN Operations Center

## Scope

The Operations Center extends the existing FastAPI, Supabase, Hermes, Prometheus, Grafana, and VPS deployment architecture. It does not create a parallel control plane.

## Capabilities

- Unified health at `GET /api/v1/ops/health`
- Persistent health evidence, incidents, alerts, remediation requests, approvals, and audit events
- Admin-protected incident and remediation APIs
- Safe-by-default VPS operations agent
- Low-risk, allowlisted container restarts only when `OPS_AUTO_REMEDIATE=true`
- Mandatory approval records for database migrations, production deployment, secret rotation, main-branch merge, and firewall changes
- External TLS, availability, latency, and HTTP 5xx verification every 15 minutes through GitHub Actions
- Explicit production schema-readiness verification
- Encrypted configuration backup support using age

## Required configuration

Backend environment:

```text
OPS_ADMIN_TOKEN=<random 32+ byte secret>
OPS_FRONTEND_URL=https://d3vonn.io
OPS_BACKEND_READY_URL=https://devonn-ai-api-production.up.railway.app/health/ready
SUPABASE_URL=<production project URL>
SUPABASE_SERVICE_ROLE_KEY=<secret manager value>
```

`OPS_BACKEND_READY_URL` intentionally targets the certified Railway service while Issue #540 tracks the permanent `api.d3vonn.io` custom-domain cutover. Change it back to the branded hostname only after the custom domain serves the canonical Railway deployment and passes the full backend API audit.

VPS agent environment:

```text
OPS_AUTO_REMEDIATE=false
OPS_FAIL_ON_UNHEALTHY=false
```

Set auto-remediation to true only after observing the agent in report-only mode.

## Deployment order

1. Apply `20260719090000_d3vonn_operations_center.sql` to staging.
2. Confirm all six tables exist and RLS is enabled.
3. Deploy the backend and call `/api/v1/ops/health`.
4. Run `python scripts/ops/d3vonn_ops_agent.py` in report-only mode.
5. Install the agent as a systemd timer at a five-minute cadence.
6. Configure `AGE_RECIPIENT` and run the backup script.
7. Dispatch `D3VONN Operations Verification` and approve the protected production schema check.
8. Promote to production only after staging evidence is green.

## Suggested systemd units

`/etc/systemd/system/d3vonn-ops-agent.service`:

```ini
[Unit]
Description=D3VONN governed operations agent
After=docker.service network-online.target
Requires=docker.service

[Service]
Type=oneshot
WorkingDirectory=/opt/supreme-ai-deployment-hub
EnvironmentFile=/opt/supreme-ai-deployment-hub/.env.production
ExecStart=/usr/bin/python3 /opt/supreme-ai-deployment-hub/scripts/ops/d3vonn_ops_agent.py
NoNewPrivileges=true
PrivateTmp=true
ProtectSystem=strict
ReadWritePaths=/var/run/docker.sock /var/backups/d3vonn
```

`/etc/systemd/system/d3vonn-ops-agent.timer`:

```ini
[Unit]
Description=Run D3VONN operations checks every five minutes

[Timer]
OnBootSec=2min
OnUnitActiveSec=5min
Persistent=true

[Install]
WantedBy=timers.target
```

## Backup installation

Install age and schedule the backup daily:

```bash
install -m 0750 scripts/ops/backup_production_config.sh /usr/local/sbin/d3vonn-backup
AGE_RECIPIENT='age1...' /usr/local/sbin/d3vonn-backup
```

Plaintext environment files are never placed in the archive. They are included only as individually encrypted `.age` files when `AGE_RECIPIENT` is configured.

## Approval matrix

| Action | Automatic | Human approval |
|---|---:|---:|
| Health check | Yes | No |
| Record incident | Yes | No |
| Restart allowlisted failed worker | Optional | No |
| Rotate application logs | Optional | No |
| Retry transient workflow | Optional | No |
| Database migration | No | Required |
| Production deployment | No | Required |
| Secret rotation | No | Required |
| Merge to main | No | Required |
| Firewall policy change | No | Required |

## Recovery

1. Disable automation: `systemctl disable --now d3vonn-ops-agent.timer`.
2. Inspect `ops_remediations` and `ops_audit_events` for the last successful action.
3. Use the recorded rollback reference.
4. Restore the latest verified archive from `/var/backups/d3vonn`.
5. Validate Compose with `docker compose config` before recreation.
6. Confirm Redis remains internal-only and MailHog remains absent from production.
7. Re-enable report-only monitoring before restoring automatic remediation.

## Completion criteria

- Operations migration applied
- `/api/v1/ops/health` returns healthy or documented degraded states
- Scheduled external verification passes TLS, availability, latency, and 5xx checks against the current canonical backend
- Production `dashboard_schema_readiness` returns `{"ready": true, "missing": []}`
- Backup archive passes SHA-256 verification and encrypted secret recovery test
- Every remediation contains evidence and a rollback reference
- Protected actions remain pending until a human approval record exists
