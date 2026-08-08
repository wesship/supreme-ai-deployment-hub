# Genesis migration extraction audit

This note records the safety review for the Genesis database slice extracted from historical PR #643.

## Scope

The migration chain is ordered from `20260726000000` through `20260726000900` and contains only Genesis schema, policy, quality, canonical-key, and atomic mutation RPC changes.

## Dependency review

- Genesis migrations do not reference non-Genesis objects in the `public` schema.
- The expected external dependency is Supabase Auth: `auth.users`, `auth.uid()`, and `auth.role()`.
- The historical #643 preview failure for missing `public.api_connections` occurred before Genesis migrations ran. Current `main` contains the restored prerequisite migration `20251004021130_af51b130-ee89-4ff3-bbb8-9eec52394ac1.sql`, which creates that table before the 2026 security migration that consumes it.

## Security review

The chain enables RLS, restricts internal/outbox mutation surfaces, moves project-access evaluation behind a private helper schema, and limits governed mutation RPCs to `service_role`.

## Deployment boundary

Merging this source slice does not itself authorize or perform a production migration. Production application remains a separately controlled deployment action. Genesis API routes are not mounted by this slice.
