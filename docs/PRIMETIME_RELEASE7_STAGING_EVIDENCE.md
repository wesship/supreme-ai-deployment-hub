# PRIMETIME Release 7 — Staging Evidence

## Candidate

| Item | Value |
|---|---|
| Staging candidate branch | `primetime/release7-staging` |
| Candidate commit | `dbff17c2333194af20364a66613ea19c34ee6618` |
| Pull request | [#965](https://github.com/wesship/supreme-ai-deployment-hub/pull/965) |
| Preview deployment | `https://supreme-ai-deployment-3oey17eps-wesships-projects.vercel.app` |
| Deployment state | Successful |

## Verified Preview Evidence

On 2026-08-18 UTC, the root preview URL returned the D3VONN.IO application successfully. The protected Release 7 route, `/primetime/release-7`, redirected to `/login?redirect=%2Fprimetime%2Frelease-7` rather than rendering telemetry publicly or producing a client error. This confirms the preview route exists and that the frontend authentication boundary is active.

## Database Preflight

The GitHub staging environment identifies Supabase project `ypomzwhtaamxdmcwtpyf` as its protected staging reference. Its migration history and schema inventory do **not** currently contain the PRIMETIME governed-runtime foundation, including `public.primetime_workspaces`, `public.primetime_workspace_memberships`, `public.primetime_roles`, and `public.primetime_audit_events`.

Release 7 has foreign-key and role-control dependencies on that foundation. It must not be applied independently to this target. The safe sequence is to apply the PRIMETIME Release 1 through Release 6 baseline migrations first, verify their migration history and schema, then run the Release 7 preview and controlled apply.

## Required Baseline-Promotion Sequence

| Order | Controlled action | Required result |
|---|---|---|
| 1 | A workflow-authorized maintainer runs the protected rollout in **preview** mode against the staging project. | The preview supplies the authoritative pending migration order and identifies any historical migration drift. |
| 2 | The maintainer reconciles and applies the absent governed-runtime baseline beginning with `20260718150000_primetime_release1_crm_foundation.sql`, continuing through the Release 6 hardening migration and any later PRIMETIME reconciliation migrations required by the preview. | `primetime_workspaces`, role and membership tables, audit tables, and the Release 1–6 governed schema appear in the staging inventory with migration history recorded. |
| 3 | The maintainer reruns the protected rollout in **preview** mode with the Release 7 candidate branch. | `20260817200000_primetime_release7_advanced_telemetry.sql` is the verified pending PRIMETIME increment and its SQL plan is reviewed. |
| 4 | After compliance review and change authorization, the workflow-authorized maintainer runs the protected **apply** mode with the required `APPLY_PRIMETIME` confirmation. | Release 7 tables, RLS settings, indexes, and immutable-history triggers are present in staging. |
| 5 | The release owner dispatches the read-only Release 6 staging gate with sanctioned frontend and API URLs, then validates authorized Release 7 signal, SLO, evaluation, and alert flows. | Evidence supports a staging-ready decision; no production promotion occurs in this sequence. |

## Workflow Status

The manual `PRIMETIME Supabase Rollout` preview could not be dispatched by the current GitHub integration because its token lacks workflow-dispatch permission. Repository rules also prevent the current integration from updating the existing staging-gate workflow on the protected `main` branch. Neither limitation was bypassed.

The pull request’s Vercel deployment checks completed successfully. The Supabase Preview check was cancelled by the external integration. Other repository checks are retained in GitHub as the authoritative live evidence; the D3VONN.IO testing workflow was still running during the initial evidence capture.

## Release Decision

> **Not ready for database activation.** The Release 7 code is staged and its preview is healthy, but database activation is blocked until the missing PRIMETIME baseline is promoted to the configured staging project and a workflow-authorized identity performs the protected rollout preview.
