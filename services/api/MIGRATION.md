# API Service Migration

## Target service

`services/api`

## Source of truth

Existing FastAPI backend:

- `backend/main.py`
- `backend/api/`
- `backend/agents/`
- `backend/middleware/`
- `backend/db/`
- `backend/requirements.txt`
- `Dockerfile.hardened` for hardened production image reference

## Current cut

Cut 1 does not physically move the backend package. It adds a service-specific Docker adapter at `services/api/Dockerfile` while keeping the Docker build context at repo root.

This proves the API staged service boundary without destabilizing imports that currently expect `backend.*`.

## Entrypoint

```bash
uvicorn backend.main:app --host 0.0.0.0 --port 8000
```

## Health contract

Required endpoints:

```bash
curl -f http://localhost:8000/health
curl -f http://localhost:8000/ready
```

## Environment contract

Required staging posture:

```text
ENVIRONMENT=staging
AUTONOMY_MODE=guarded
EXECUTION_MODE=dry-run
```

Service connections:

- application database connection URL
- Redis-compatible connection URL
- vector database URL
- allowed frontend origins

Provider credentials must remain platform-managed and must not be committed.

## Deferred

- physically moving `backend/` into `services/api/backend/`
- distroless hardened runtime conversion
- API-to-database migration checks
- API smoke test workflow that boots the container and curls `/health` + `/ready`
