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

## Release 7 Preview and Controlled Staging Apply

The Release 7 preview reviewed the published `20260817200000_primetime_release7_advanced_telemetry.sql` candidate. It creates four governed observability tables, supporting safe-dimension and lifecycle functions, five bounded indexes, and six immutable-history, no-delete, or timestamp triggers. The preview contained no `DROP TABLE`, `TRUNCATE`, data deletion, or column-drop operation. Focused Release 7 contracts passed **23 tests** before apply.

The controlled staging apply completed successfully as `primetime_release7_advanced_telemetry` in migration history at version `20260818015205`. Live verification confirms all four Release 7 tables have RLS enabled and their expected lifecycle trigger counts. The database security advisor reports these tables as informational `rls_enabled_no_policy` items, consistent with their intentionally backend-only, service-role API access model; it reports no critical direct-access finding for Release 7.

| Release 7 table | RLS | Lifecycle triggers |
|---|---:|---:|
| `primetime_telemetry_signals` | Enabled | 1 |
| `primetime_slo_definitions` | Enabled | 2 |
| `primetime_slo_evaluations` | Enabled | 1 |
| `primetime_telemetry_alerts` | Enabled | 2 |

## Required Baseline-Promotion Sequence

| Order | Controlled action | Required result |
|---|---|---|
| 1 | Apply and verify the Release 1–6 baseline. | **Completed** on 2026-08-18 UTC; migration history and schema inventory confirm the foundation. |
| 2 | Resolve the Release 1–6 RLS advisor finding through a reviewed migration that enables RLS on `primetime_roles` and `primetime_compliance_rules` and defines appropriate policies. | **Completed** with `20260818014000_primetime_reference_table_rls_hardening.sql`. Both tables now have RLS enabled, deny all direct anon/authenticated privileges, and retain service-role access. |
| 3 | Run the protected Release 7 preview after the RLS hardening decision. | **Completed**; the reviewed candidate contains four new tables, five indexes, and six lifecycle triggers, with no destructive table or data operation. |
| 4 | After compliance review and change authorization, run the protected Release 7 apply. | **Completed** as staging migration `primetime_release7_advanced_telemetry` (`20260818015205`); Release 7 tables, RLS settings, indexes, and immutable-history triggers are present. |
| 5 | Dispatch the read-only Release 6 staging gate with sanctioned frontend and API URLs, then validate authorized Release 7 signal, SLO, evaluation, and alert flows. | **Outstanding.** Evidence supports a staging-ready decision only after the read-only gate and authorized operational flows pass; no production promotion occurs in this sequence. |

## Workflow Status

The manual `PRIMETIME Supabase Rollout` preview could not be dispatched by the current GitHub integration because its token lacks workflow-dispatch permission. Repository rules also prevent the current integration from updating the existing staging-gate workflow on the protected `main` branch. Neither limitation was bypassed.

The pull request’s Vercel deployment checks completed successfully. The Supabase Preview check was cancelled by the external integration. Other repository checks are retained in GitHub as the authoritative live evidence; the D3VONN.IO testing workflow was still running during the initial evidence capture.

## Security Finding and Release Decision

The direct-access RLS finding has been resolved by the reviewed `20260818014000_primetime_reference_table_rls_hardening.sql` migration. Live staging verification confirmed `public.primetime_roles` and `public.primetime_compliance_rules` have RLS enabled and no direct anon or authenticated table privileges. The subsequent security-advisor output no longer includes either table.

Informational RLS-without-policy findings remain for other PRIMETIME tables that are intentionally backend-only; RLS prevents direct browser access and trusted service-role API paths retain governed access. Separate mutable-search-path warnings for legacy PRIMETIME helper functions remain tracked as hardening work, but they do not reopen the direct table-access issue.

> **Release 1–6 baseline, its critical RLS prerequisite, and the Release 7 staging migration are complete. Release 7 is ready for the read-only staging gate and authorized operator-flow validation; no production promotion has occurred.**
