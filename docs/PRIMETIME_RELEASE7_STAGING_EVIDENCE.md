# PRIMETIME Release 7 — Staging Evidence

## Candidate

| Item | Value |
|---|---|
| Staging candidate branch | `primetime/release7-staging` |
| Candidate commit | `44add8a2` |
| Pull request | [#965](https://github.com/wesship/supreme-ai-deployment-hub/pull/965) |
| Preview deployment | `https://supreme-ai-deployment-3oey17eps-wesships-projects.vercel.app` |
| Deployment state | Successful |

## Verified Preview Evidence

On 2026-08-18 UTC, the root preview URL returned the D3VONN.IO application successfully. The protected Release 7 route, `/primetime/release-7`, redirected to `/login?redirect=%2Fprimetime%2Frelease-7` rather than rendering telemetry publicly or producing a client error. This confirms the preview route exists and that the frontend authentication boundary is active.

## Database Baseline Deployment

On 2026-08-18 UTC, the approved PRIMETIME Release 1–6 baseline was applied in order to the active `Supreme_ai_deployment_hub_staging` Supabase project (`ypomzwhtaamxdmcwtpyf`). Each named migration completed successfully and is present in staging migration history.

| Sequence | Applied staging migration |
|---|---|
| 1 | `primetime_release1_crm_foundation` |
| 2 | `primetime_release1_enforcement` |
| 3 | `primetime_release2_scheduling` |
| 4 | `primetime_release3_communications` |
| 5 | `primetime_release4_audit_compatibility` |
| 6 | `primetime_release4_ai_assistance` |
| 7 | `primetime_release5_analytics` |
| 8 | `primetime_release6_production_hardening` |

The staging inventory now contains the required governed-runtime foundation, including `public.primetime_workspaces`, `public.primetime_workspace_memberships`, `public.primetime_roles`, and `public.primetime_audit_events`, plus the Release 2–6 scheduling, communications, assistance, analytics, and production-hardening tables.

## Required Baseline-Promotion Sequence

| Order | Controlled action | Required result |
|---|---|---|
| 1 | Apply and verify the Release 1–6 baseline. | **Completed** on 2026-08-18 UTC; migration history and schema inventory confirm the foundation. |
| 2 | Resolve the Release 1–6 RLS advisor finding through a reviewed migration that enables RLS on `primetime_roles` and `primetime_compliance_rules` and defines appropriate policies. | **Blocked pending a security-policy decision.** Do not enable RLS without the required access policies, because that would change direct client access behavior. |
| 3 | Run the protected Release 7 preview after the RLS hardening decision. | `20260817200000_primetime_release7_advanced_telemetry.sql` is reviewed as the next PRIMETIME increment. |
| 4 | After compliance review and change authorization, run the protected Release 7 apply. | Release 7 tables, RLS settings, indexes, and immutable-history triggers are present in staging. |
| 5 | Dispatch the read-only Release 6 staging gate with sanctioned frontend and API URLs, then validate authorized Release 7 signal, SLO, evaluation, and alert flows. | Evidence supports a staging-ready decision; no production promotion occurs in this sequence. |

## Workflow Status

The manual `PRIMETIME Supabase Rollout` preview could not be dispatched by the current GitHub integration because its token lacks workflow-dispatch permission. Repository rules also prevent the current integration from updating the existing staging-gate workflow on the protected `main` branch. Neither limitation was bypassed.

The pull request’s Vercel deployment checks completed successfully. The Supabase Preview check was cancelled by the external integration. Other repository checks are retained in GitHub as the authoritative live evidence; the D3VONN.IO testing workflow was still running during the initial evidence capture.

## Security Finding and Release Decision

The post-deployment security scan identified a critical direct-access condition: RLS is disabled on `public.primetime_roles` and `public.primetime_compliance_rules`. It also identified informational RLS-without-policy findings for the remaining PRIMETIME tables and mutable search-path warnings for PRIMETIME helper functions. The critical RLS condition was **not** remediated automatically, because enabling RLS without reviewed policies can block legitimate access paths.

> **Release 1–6 baseline deployment is complete. Release 7 is not yet safe to unblock.** A reviewed RLS hardening decision for the two directly exposed tables is required first, followed by the protected Release 7 preview, controlled apply, and read-only staging gate.
