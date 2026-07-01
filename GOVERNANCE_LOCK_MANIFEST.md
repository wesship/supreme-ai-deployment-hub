# Governance Lock Manifest

This file records the governance state of the D3VONN repository. It ensures that
critical project files, auto-generated sources, and migration integrity are
maintained across all contributions.

## Protected Files

The following files are auto-generated and must not be edited manually:

| File | Purpose |
|------|---------|
| `src/integrations/supabase/client.ts` | Supabase client (auto-generated) |
| `src/integrations/supabase/types.ts` | Supabase types (auto-generated) |
| `.env` | Environment configuration (managed externally) |

## Append-Only Paths

- `supabase/migrations/**` — Migration files are append-only. Existing migrations
  must never be modified or deleted.

## Locked Configuration

- `supabase/config.toml` — The `project_id` field is locked and must not change.

## Required Governance Files

- `GOVERNANCE_LOCK_MANIFEST.md` (this file)
- `README.md`
- `package.json`
- `.github/workflows/governance-drift.yml`

## Policy Version

- **Schema version:** 1.0.0
- **Last updated:** 2026-06-30
- **Enforced by:** `.github/workflows/governance-drift.yml`
