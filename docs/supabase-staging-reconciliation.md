# Staging migration reconciliation

## Verified staging repair — October 6, 2026

Target: `Supreme_ai_deployment_hub_staging` (`ypomzwhtaamxdmcwtpyf`). Supabase reported `ACTIVE_HEALTHY`. Source inspection used repository commit `321e8f39b73bbfd897a13dccd44ea1b7dcf408d2`.

Before repair, live catalog queries showed that `client_ai_leads`, `client_ai_profiles`, `client_ai_sources`, and `client_ai_memory_commits` were absent. The migration ledger contained 184 applied versions, 88 of which had no exact version-prefix match in the root checkout. Filename differences do not by themselves prove missing schema.

Applied staging-only migration `20261006123338_reconcile_client_ai_staging_schema` by concatenating these existing repository migrations in dependency order:

1. `20260906143000_client_ai_funnel.sql`
2. `20260907004500_client_ai_ingestion_tracking.sql`
3. `20260927032000_client_ai_memory_commits.sql`
4. `20260927040500_client_ai_service_role_grants.sql`

The migration API returned success. Subsequent live catalog queries confirmed all four tables, RLS enabled on each, no SELECT/INSERT/UPDATE/DELETE privileges for either `anon` or `authenticated`, and all four privileges for `service_role`. All five ingestion-tracking columns were present: `ingestion_run_id`, `hermes_task_id`, `current_stage`, `error_message`, `completed_at`.

Production database, integration working directories, existing users, and existing migration records were not changed. This repair adds a staging migration record; it does not reconcile the remaining migration history. Do not add this staging-only generated version to the production-linked root migrations just to silence the Preview check.

### Remaining gates

- Capture and replay a reviewed staging schema in an isolated migration directory, following the workflow below; full migration reconciliation remains open.
- A live metadata query found no `custom:authentik` row in `auth.custom_oauth_providers`. Configure a verified staging Authentik instance and its issuer/client/callback settings before attempting OIDC login. Keep the client secret server-side.
- Verify login, logout, denied access, account linking, ownership preservation, and two-account isolation through the application/backend. Catalog grants do not prove API-level tenant isolation.
- The separate local Authentik UI draft is disabled by default and is not part of this evidence PR. Nine standalone configuration-guard assertions passed, but the OAuth flow, UI rendering, full typecheck, and application integration were not verified. Dependency setup was blocked by a local Node/pnpm version mismatch (repository requires Node 22 and pnpm 9).
- Do not treat provider-level logout as automatic revocation of a Supabase session; verify both session lifecycles during the pilot.

## Historical September 12 preparation

The Supabase Preview check for project `ypomzwhtaamxdmcwtpyf` reports `Remote migration versions not found in local migrations directory`. As of September 12, 2026, staging records 167 applied versions, 74 of which are absent from the repository's root `supabase/migrations` directory. Production project `tjygexesognbkwualywq` records 84 versions and has a different set of 72 absent versions. Only two applied versions are shared between the projects.

Of the 74 staging-only missing versions, 20 have the same SQL under a different repository filename after disregarding comments/formatting; four have similarly named but different SQL; 50 have no similarly named file. Another 33 staging records have no stored SQL statements. The repository also has deliberate no-op history markers introduced in [PR #900](https://github.com/wesship/supreme-ai-deployment-hub/pull/900), so a recorded version alone does not prove that a clean database can recreate the live schema.

## First artifact: private schema snapshot

On a trusted machine with Docker and a current Supabase CLI, set `STAGING_DATABASE_URL` securely to the staging project's direct or session-pooler Postgres URI, then run `bash scripts/staging-schema-snapshot.sh`. The command validates the project ref and writes a schema-only dump to a mode-0600 temporary file outside the Git checkout. It does not read user rows, run migrations, or alter either database. Keep the URL and dump out of GitHub logs and commits; review SQL literals and access controls before publishing anything.

Supabase documents that [`db dump` defaults to schema-only, excluding data and custom roles](https://supabase.com/docs/reference/cli/supabase-db-dump). The command deliberately does not call `db pull`, which can update remote migration history.

## Required validation before changing the integration

1. Compare the snapshot to the root migrations and capture the staging schema in an isolated `supabase/` working directory. Do not copy historical staging SQL or add no-op markers to the production-linked root directory merely to satisfy version numbers.
2. Replay that directory against a disposable preview project and verify tables, functions, grants, RLS policies and representative API queries. Resolve the 33 history entries without statements based on observed schema and reviewed source, not guessed SQL.
3. Only after replay succeeds, set the staging project's [GitHub integration working directory](https://supabase.com/docs/guides/deployment/branching/github-integration) to the tested directory. Keep production's working directory unchanged. Verify the Supabase Preview check passes on the exact PR head.

The snapshot script does not modify the GitHub integration or the Supabase database. The October 6 staging-only repair is recorded above. A draft PR containing them is a preparation gate, not a migration fix.
