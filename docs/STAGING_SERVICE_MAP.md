# Devonn.ai Staging Service Map

This document normalizes the existing fragmented workspace into a clean staging deployment shape without deleting or rewriting the original project folders.

## Target root layout

```text
services/
  frontend/
  api/
  orchestrator/
  workers/
infra/
  render/
  vercel/
observability/
  local/
docs/
  STAGING_DEPLOYMENT_RUNBOOK.md
  ENVIRONMENT_VARIABLES.md
  GUARDRAILS.md
```

## Existing folder to staged service mapping

| Staged service | Primary source | Secondary source | Reason |
| --- | --- | --- | --- |
| `services/frontend` | `supreme-ai-deployment-hub` root frontend | `devonn-ai` frontend assets if still active | Vite/React frontend and existing `vercel.json` live here. |
| `services/api` | `hermes-ai` | `devonn-gitnexus-bridge` | FastAPI-style API/service endpoints already expose `/health`. |
| `services/orchestrator` | `MyClaw` | `hermes-ai` runtime coordination modules | MyClaw owns scheduler/control-plane behavior and already has `/health` and `/ready`. |
| `services/workers` | `MyClaw` runtime workers | future queue consumers | Worker runtime should consume Redis-backed jobs and call API/orchestrator boundaries. |
| `observability/local` | new root foundation | existing scattered metrics/log scripts | Local-only staging visibility for compose validation. |
| `infra/render` | new root foundation | existing Dockerfiles | Render staging blueprint for API/orchestrator/worker managed services. |
| `infra/vercel` | existing `vercel.json` | new staging notes | Frontend deployment remains Vercel-first. |

## Normalization rule

Do not move production code until the staging contract is green. Use this phase to add a root-level runtime wrapper and documentation first. Once compose, staging CI, and health checks are stable, code can be copied or extracted into `services/*` in a follow-up PR.

## Staging contract

Every staged service must provide:

- deterministic build command
- deterministic start command
- `/health` endpoint where applicable
- `/ready` endpoint for orchestrator-style services where applicable
- environment variables documented in `docs/ENVIRONMENT_VARIABLES.md`
- no secrets committed to git
- no autonomous irreversible actions enabled by default

## Current status

This branch intentionally adds the deployment foundation first:

- root `docker-compose.yml`
- Render blueprint stub
- Vercel staging notes
- staging CI workflow
- staging runbook
- environment variable contract
- guardrails contract

The next PR should extract real service entrypoints under `services/*` or convert these wrappers into direct build contexts once the exact runtime source is confirmed.
