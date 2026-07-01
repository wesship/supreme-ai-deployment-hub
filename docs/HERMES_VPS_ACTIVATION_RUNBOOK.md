# Hermes VPS Activation Runbook

## Goal

Bring Hermes online on the VPS with a verified, version-aware startup path before connecting Vapi, voice, dashboards, or production agent traffic.

## Activation Order

1. Provision VPS base system.
2. Harden SSH and firewall.
3. Install Docker and Docker Compose.
4. Create Hermes runtime directory.
5. Install environment variables.
6. Pull latest `main` from GitHub.
7. Start services.
8. Verify backend health.
9. Verify Hermes intake, worker, callback, memory, and Knowledge Graph write-back.
10. Connect voice/Vapi only after Hermes loop passes.

## Required VPS Environment Variables

Critical:

```env
JWT_SECRET=
ENCRYPTION_KEY=
HERMES_ENV=production
HERMES_DEPLOY_TARGET=vps
HERMES_DEPLOYMENT_ID=
HERMES_GIT_SHA=
HERMES_CONFIG_VERSION=1
HERMES_KG_SCHEMA_VERSION=1
HERMES_AGENT_MANIFEST_VERSION=1
```

Likely required depending on enabled services:

```env
DATABASE_URL=
REDIS_URL=
SUPABASE_URL=
SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
OPENAI_API_KEY=
PINECONE_API_KEY=
PINECONE_INDEX=devonn-rag
SENTRY_DSN=
```

Do not place real secrets in the repo.

## Hermes Version-Aware Startup Contract

On startup, Hermes should record:

```json
{
  "service": "hermes",
  "environment": "production",
  "deploy_target": "vps",
  "git_sha": "<current sha>",
  "deployment_id": "<timestamp-or-release-id>",
  "config_version": "1",
  "db_migration_version": "<latest-applied-migration>",
  "kg_schema_version": "1",
  "agent_manifest_version": "1",
  "started_at": "<iso-timestamp>",
  "status": "STARTING|READY|DEGRADED|FAILED"
}
```

This record should be written to Hermes memory, the operational database, and the Knowledge Graph.

## Required Health Checks

Backend:

```bash
curl -i https://YOUR-BACKEND-DOMAIN/api/health
```

Hermes job intake:

```bash
curl -i -X POST https://YOUR-BACKEND-DOMAIN/api/hermes/jobs \
  -H 'Content-Type: application/json' \
  -d '{"type":"healthcheck","source":"vps-activation","payload":{"message":"Hermes VPS activation test"}}'
```

Expected task lifecycle:

```text
PENDING -> RUNNING -> COMPLETED
```

## Pass Criteria

Hermes is ready only when:

- Backend health returns HTTP 200.
- `JWT_SECRET` and `ENCRYPTION_KEY` initialize without errors.
- Job intake accepts a test task.
- Worker registers successfully.
- Worker claims the task.
- Callback marks the task complete.
- Result writes to memory.
- Result writes to the Knowledge Graph.
- Logs show no auth, encryption, database, Redis, or callback failures.

## Do Not Connect Yet If

- `/api/health` is not HTTP 200.
- Hermes tasks stay stuck in `PENDING`.
- Worker cannot claim tasks.
- Callback endpoint fails.
- Memory/KG write-back fails.
- Secrets are missing or invalid.
- Database migrations are behind the current code.

## After Pass

Then connect in this order:

1. Vapi webhook endpoint.
2. Voice service credentials.
3. Agent routing rules.
4. Dashboard observability.
5. Production user-facing automations.
