# PRIMETIME Gate 4 — Release 6 Production Promotion Evidence

## Scope

Production Supabase project: `tjygexesognbkwualywq`.

This gate promotes only the controls that are applicable to the current production schema. Production is not schema-identical to staging, so the Gate 3 staging migration is **not** replayed verbatim.

## Preflight findings

Observed before promotion on 2026-09-06:

- Production migration history is materially different from staging and does not contain the Gate 3 migration version.
- `public.aquagov_workers` is absent in production.
- `public.api_connections`, `public.cloud_credentials`, and `public.mcp_connections` are absent in production; their credential hardening is therefore not applicable and no objects are created for them.
- `public.primetime_workspace_memberships` is already backend-only:
  - `service_role` has table privileges.
  - `anon` and `authenticated` have no direct table privileges.
  - RLS has an explicit `Deny direct browser access` policy.
- Six service-only tables exist in production:
  - `jetson_command_audit`
  - `jetson_commands`
  - `jetson_devices`
  - `jetson_telemetry`
  - `quantum_optimization_experiments`
  - `quantum_optimization_metrics`
- All six had RLS enabled and no policies.
- The Jetson tables already denied direct browser table privileges.
- The two Quantum tables still granted `SELECT` to `anon` and `authenticated`.
- The production Security Advisor reported exactly six `rls_enabled_no_policy` INFO findings for those six tables and no SECURITY DEFINER warnings in this scope.

## Promotion migration

`20260906151600_primetime_gate4_production_service_only_hardening.sql`

The migration:

1. Enables RLS on each existing service-only target table.
2. Revokes all privileges from `PUBLIC`, `anon`, and `authenticated`.
3. Grants full required table authority to `service_role`.
4. Creates an explicit `Deny direct browser access` RLS policy for `anon` and `authenticated`.
5. Does not create staging-only objects that are absent in production.

## Expected post-promotion state

For every targeted table:

- `anon` direct SELECT: false
- `authenticated` direct SELECT: false
- `service_role` SELECT: true
- RLS enabled: true
- policy count >= 1
- Security Advisor no longer reports `rls_enabled_no_policy`

## Rollback plan

This migration is privilege-tightening only and does not delete or transform data.

If an unexpected production dependency is discovered:

1. Keep RLS enabled.
2. Drop `Deny direct browser access` only on the affected table.
3. Restore only the minimum prior privilege required by the dependency.
4. For the two Quantum tables, the pre-promotion browser state was `SELECT` granted to `anon` and `authenticated`; restore those grants only as an emergency rollback, then open a corrective security incident because that posture is intentionally deprecated.
5. Jetson tables had no browser privileges before this migration and should not need privilege restoration.

Database-level disaster recovery remains available through Supabase scheduled backups/PITR according to the project plan; restoring a full database is not expected for this privilege-only change.

## Promotion acceptance criteria

Gate 4 passes only after:

- repository CI passes, including PRIMETIME Staging Certification and Zero-Downtime Migration;
- the migration is applied to production through the reviewed migration path;
- production Security Advisor is re-run;
- production privilege/policy queries match the expected state;
- production application health/readiness remains green;
- regulated PRIMETIME blocked endpoints remain absent/denied;
- no production rollback is required.
