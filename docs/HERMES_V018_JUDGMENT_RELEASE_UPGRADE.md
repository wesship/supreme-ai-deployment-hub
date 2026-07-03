# Hermes Agent v0.18.0 — D3VONN.IO Upgrade Plan

Release target: v2026.7.1 / The Judgment Release.

## What this branch adds

- Evidence-based completion contracts for Hermes tasks.
- Model-council metadata for Mixture-of-Agents review.
- Background subagent tracking tables.
- Journey-visible learning metadata for reusable workflows.
- Runtime defaults in backend/hermes/task_engine.py.

## Required deployment order

1. Pull this branch into the VPS checkout.
2. Apply supabase/migrations/20260702_hermes_v018_judgment_release.sql.
3. Configure the VPS runtime for release version v2026.7.1, completion contracts, background subagents, and the default model council.
4. Rebuild and restart the backend, Hermes, and worker services.
5. Verify container status, Hermes logs, and API health.

## Completion contract example

A deployment task should require evidence such as tests passed, backend health returned HTTP 200, frontend deployment finished, database migration passed, and worker boot passed. Hermes will route the task to manual review instead of marking it complete if required evidence is missing.

## D3VONN recommended model councils

- Executive Council: strategy, roadmap, launch decisions.
- Deployment Council: backend, frontend, database, infrastructure checks.
- Security Council: secrets, auth, SOC, audit and policy review.
- Opportunity Council: RWA, tokenized real estate, insurance, lead scoring.

## Rollback

Disable completion contracts and background subagents in runtime configuration, then restart Hermes.
