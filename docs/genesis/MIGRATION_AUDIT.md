# Genesis migration extraction audit

This note records the safety review for the Genesis database slice extracted from historical PR #643.

## Scope

The migration chain is ordered from `20260726000000` through `20260726000900` and contains only Genesis schema, policy, quality, canonical-key, and atomic mutation RPC changes.

## Dependency review

- Genesis migrations do not reference non-Genesis objects in the `public` schema.
- The expected external dependency is Supabase Auth: `auth.users`, `auth.uid()`, and `auth.role()`.
- The historical #643 preview failure for missing `public.api_connections` occurred before Genesis migrations ran. Current `main` contains the restored prerequisite migration `20251004021130_af51b130-ee89-4ff3-bbb8-9eec52394ac1.sql`, which creates that table before the 2026 security migration that consumes it.

## Current Supabase compatibility

Supabase now requires applications to treat Data API grants as explicit rather than relying on legacy default privileges. The Genesis repository uses server-side PostgREST with the service-role key, so the final migration explicitly grants only `SELECT`, `INSERT`, `UPDATE`, and `DELETE` on Genesis tables to `service_role`.

No new direct table privileges are granted to `anon` or `authenticated`.

## Staging evidence

Read-only inspection of the dedicated `Supreme_ai_deployment_hub_staging` project on 2026-08-08 confirmed:

- all ten Genesis migration versions (`20260726000000` through `20260726000900`) are already recorded in staging;
- all 26 Genesis tables have RLS enabled;
- `service_role` has the four table privileges required by the backend repository;
- sensitive Genesis `SECURITY DEFINER` mutation functions are not executable by `authenticated`;
- Supabase Security Advisor reports no Genesis-specific security findings;
- remaining Genesis performance notices are unused-index observations on an inactive feature surface, not missing-index findings.

The production project has no Genesis migration versions recorded as of the same inspection.

## Deployment boundary

Merging this source slice does not itself authorize or perform a production migration. Production application remains a separately controlled deployment action. Genesis API routes are not mounted by this slice.
