# DEVONN.AI — Governance Lock Manifest

Version: 1.0.0
Status: ACTIVE
Owner: wesship/supreme-ai-deployment-hub

## Purpose

This manifest declares the governance baseline for the DEVONN.AI platform.
It is enforced by `.github/workflows/governance-drift.yml` on every pull
request targeting protected branches.

## Protected Branches

- `main`

## Required Files

The following files MUST exist at the repository root. Removing or renaming
any of them causes governance drift and blocks the PR:

- `GOVERNANCE_LOCK_MANIFEST.md` (this file)
- `README.md`
- `package.json`
- `.github/workflows/governance-drift.yml`

## Protected Paths

Changes under these paths require a maintainer review and a passing
governance check:

- `supabase/migrations/**` — database schema is append-only; no destructive
  edits to historical migration files.
- `supabase/config.toml` — project-level settings are locked; only
  function-level blocks may be added.
- `src/integrations/supabase/client.ts` — auto-generated, never hand-edit.
- `src/integrations/supabase/types.ts` — auto-generated, never hand-edit.
- `.env` — managed by Lovable Cloud, never hand-edit.

## Policy Rules

1. **No force pushes** to `main`.
2. **No direct commits** to `main`; use PRs.
3. **Infrastructure workflows** (azure, terraform, k8s) run only on `main`,
   never on `pull_request`.
4. **Edge functions** must use the caller's JWT (never service role) and
   validate input with Zod.
5. **RLS** must be enabled on every new public table, with policies keyed on
   `auth.uid() = user_id` unless explicitly public.
6. **Secrets** never committed; use Lovable Cloud secrets / GitHub Actions
   secrets.

## Drift Detection

The `governance-drift` workflow:

- verifies all Required Files exist
- diffs Protected Paths and flags destructive changes
- fails the PR check if any rule is violated

## Change Process

To amend this manifest:

1. Open a PR editing `GOVERNANCE_LOCK_MANIFEST.md`.
2. Bump the `Version` field.
3. Obtain maintainer approval.
4. Merge to `main`.

END OF MANIFEST
