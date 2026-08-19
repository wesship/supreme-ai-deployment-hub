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
| 5 | Run the read-only Release 6 staging gate with sanctioned frontend and API URLs, then validate authorized Release 7 signal, SLO, evaluation, and alert flows. | **Partially completed.** The gate runner and its contract coverage are published in `89bdb418`; database-level operational validation passed. The live frontend/API gate remains withheld until a distinct sanctioned staging API URL is available. |

## Release 6 Gate and Release 7 Operational Validation

The executable Release 6 gate runner was restored to the staging candidate in `89bdb418`. Its syntax validation and **8 focused contract tests** passed. The repository rule forbids the current GitHub App from updating `.github/workflows/staging-release-gate.yml`, so the runner is published for manual read-only execution while the workflow remains under its protected boundary.

A dedicated staging API target could not be confirmed from the available integrations. The documented `https://staging-api.d3vonn.io/health` hostname does not resolve. Vercel deployment details and the advertised PR preview require Vercel authentication, the enabled Vercel connector did not expose an MCP server in this session, and GitHub’s variable API returned an integration-permission denial. The latest PR workflow log shows `VITE_API_URL=https://api.d3vonn.io`, which is production and was intentionally not used for a staging gate.

The authorized Supabase integration therefore performed an isolated database-level validation using an archived, non-PII staging workspace. The controlled transaction recorded a telemetry signal, created an SLO definition, recorded a warning evaluation, created and acknowledged an alert, and verified three negative safeguards: telemetry-history updates are rejected, alert deletion is rejected, and a sensitive `token` telemetry dimension is rejected. The persisted records use only `component=validation`, `environment=staging`, and `source=staging_validation` metadata.

| Validation area | Result |
|---|---|
| Signal intake and safe dimensions | Passed |
| SLO creation and warning evaluation | Passed |
| Alert create and acknowledge lifecycle | Passed |
| Immutable signal history | Update rejected as required |
| No-delete alert lifecycle | Deletion rejected as required |
| Sensitive telemetry dimension rejection | `token` dimension rejected as required |
| Frontend/API Release 6 read-only gate | Withheld; no distinct resolving staging API target |

## Workflow Status

The manual `PRIMETIME Supabase Rollout` preview could not be dispatched by the current GitHub integration because its token lacks workflow-dispatch permission. Repository rules also prevent the current integration from updating the existing staging-gate workflow on the protected `main` branch. Neither limitation was bypassed.

The pull request’s Vercel deployment checks completed successfully. The Supabase Preview check was cancelled by the external integration. Other repository checks are retained in GitHub as the authoritative live evidence; the D3VONN.IO testing workflow was still running during the initial evidence capture.

## Security Finding and Release Decision

The direct-access RLS finding has been resolved by the reviewed `20260818014000_primetime_reference_table_rls_hardening.sql` migration. Live staging verification confirmed `public.primetime_roles` and `public.primetime_compliance_rules` have RLS enabled and no direct anon or authenticated table privileges. The subsequent security-advisor output no longer includes either table.

Informational RLS-without-policy findings remain for other PRIMETIME tables that are intentionally backend-only; RLS prevents direct browser access and trusted service-role API paths retain governed access. Separate mutable-search-path warnings for legacy PRIMETIME helper functions remain tracked as hardening work, but they do not reopen the direct table-access issue.

> **Release 1–6 baseline, its critical RLS prerequisite, and the Release 7 staging migration are complete. Database-level Release 7 operational validation passed. The frontend/API read-only gate remains intentionally withheld until a distinct sanctioned staging API target is provisioned; no production endpoint or production promotion was used.**


## Hermes Worker Recovery — Canonical Staging

The deployed Hermes Python worker uses the canonical `Supreme_ai_deployment_hub_staging` Supabase project (`ypomzwhtaamxdmcwtpyf`). It was repeatedly terminated by an HTTP health check aimed at `/health`, although `python -m backend.hermes.worker` is intentionally a non-HTTP background process. The repair therefore keeps staging canonical, removes the worker's unsafe list-then-claim behavior, and requires a Railway configuration change rather than adding a public HTTP server to the worker.

| Item | Evidence / state |
|---|---|
| Canonical database | `ypomzwhtaamxdmcwtpyf` (`Supreme_ai_deployment_hub_staging`) |
| Initial lifecycle migration | `hermes_atomic_claim_and_recovery` applied successfully on 2026-08-18 UTC |
| Forward-only SQL correction | `fix_hermes_atomic_claim_worker_alias` applied successfully on 2026-08-18 UTC |
| Python worker path | New work uses `hermes_claim_task` through a service-role RPC; the REST `status=PENDING` scan is removed from `backend.hermes.worker` |
| Lease lifecycle | Database RPCs now provide claim, heartbeat, renew, release, stale-lease reaping, and stale-worker reaping |
| Browser access | Railway was at its authentication screen in this session; the health-check mutation and redeploy remain pending authenticated access |

The initial claim function was applied as a new staging migration and its first invocation exposed an ambiguous unqualified `worker_id` reference. No application record was changed by that failed invocation. A second, forward-only migration replaced only that function with an explicit table alias; the follow-up invocation passed. This preserves an auditable migration history rather than altering the already-applied migration in place.

### Controlled Database Validation

All validation records were created solely in canonical staging with `source=staging_validation` and descriptive validation titles. They are intentionally retained as non-PII audit evidence; no regulated record was deleted.

| Validation | Result |
|---|---|
| Atomic claim | The isolated `validation-atomic-claim` task was returned as `LOCKED` with a newly created `active` lease in one function invocation. |
| Terminal release | The controlled task was marked `COMPLETED`; `hermes_release_worker_lease` returned its lease as `released`. |
| Stale-lease recovery | An intentionally expired validation lease became `expired`; its `LOCKED` task returned to `PENDING`, `retry_count` incremented to `1`, and the worker's active lease count returned to `0`. |
| Stale-worker recovery | An intentionally aged validation heartbeat marked only the validation worker `lost`, expired its lease, returned the task to `PENDING`, incremented `retry_count` to `2`, and restored active capacity to `0`. |
| RPC boundary | `anon` and `authenticated` have no execute privilege for `hermes_claim_task`; `service_role` has it. The same backend-only boundary is confirmed for `hermes_reap_stale_leases`. |
| Focused repository tests | **20 passed** for Supabase RPC infrastructure, persistence, worker runtime, and worker-dispatch coverage. |

> **Current staging status:** Canonical database primitives and the Python atomic-claim code are ready. The live worker will remain offline until Railway access is used to remove the HTTP health check from `hermes-worker-staging`, set the persistent-worker environment variables, and redeploy. No production promotion or public HTTP endpoint is part of this recovery.
