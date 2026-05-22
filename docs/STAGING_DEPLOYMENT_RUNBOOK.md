# Devonn.ai Staging Deployment Runbook

## Purpose

Create a safe, production-grade staging layer before promoting Devonn.ai workloads into AWS/EKS or production traffic.

## Deployment principle

Staging validates runtime shape, health checks, environment boundaries, and observability before real production execution is allowed.

## Service topology

```text
Vercel frontend
  -> Render API
  -> Render orchestrator
  -> Render worker
  -> managed Postgres
  -> managed Redis
  -> Qdrant/vector memory
```

Local validation uses root `docker-compose.yml`.

## Phase 1: local infra validation

Create local env file from the documented contract:

```bash
cp docs/ENVIRONMENT_VARIABLES.md /tmp/devonn-env-reference.md
cp .env.example .env.staging.local 2>/dev/null || touch .env.staging.local
```

Add only local, non-production values to `.env.staging.local`.

Run infra services:

```bash
docker compose up postgres redis qdrant
```

Check:

```bash
docker compose ps
```

## Phase 2: app service extraction

Populate these folders in a follow-up PR:

```text
services/frontend
services/api
services/orchestrator
services/workers
```

Recommended extraction order:

1. `services/frontend` from the current Vite/React frontend.
2. `services/api` from the healthiest FastAPI API source.
3. `services/orchestrator` from MyClaw scheduler/control-plane source.
4. `services/workers` from queue consumer/runtime worker source.

## Phase 3: full local app validation

After service folders are populated:

```bash
docker compose --profile app up --build
```

Required checks:

```bash
curl -f http://localhost:8000/health
curl -f http://localhost:7373/health
curl -f http://localhost:7373/ready
curl -f http://localhost:5173
```

## Phase 4: managed staging deploy

Use:

- Vercel for frontend staging.
- Render blueprint at `infra/render/render.yaml` for API, orchestrator, and worker.
- Managed Postgres, Redis, and Qdrant/compatible vector service.

Required guardrail values:

```text
ENVIRONMENT=staging
AUTONOMY_MODE=guarded
EXECUTION_MODE=dry-run
```

## Phase 5: promotion criteria

Do not promote staging until all are true:

- GitHub Actions `Staging CI` passes.
- API `/health` passes.
- Orchestrator `/health` passes.
- Orchestrator `/ready` passes.
- Worker starts without crashing.
- No secrets committed.
- Logs show blocked/guarded actions when risky actions are requested.
- Frontend can reach staging API.
- No production memory mutation is enabled.

## Rollback

If staging breaks:

1. Disable Render auto-deploy.
2. Revert the latest staging PR.
3. Restore previous Vercel preview deployment.
4. Keep production traffic unchanged.

## Next implementation PR

After this foundation lands, the next PR should add real service wrappers and Dockerfiles under `services/*` while keeping the original project folders intact until tests are green.
