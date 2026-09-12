# Staging migration reconciliation — read-only preparation

The Supabase Preview check for project `ypomzwhtaamxdmcwtpyf` reports `Remote migration versions not found in local migrations directory`. As of September 12, 2026, staging records 167 applied versions, 74 of which are absent from the repository's root `supabase/migrations` directory. Production project `tjygexesognbkwualywq` records 84 versions and has a different set of 72 absent versions. Only two applied versions are shared between the projects.

Of the 74 staging-only missing versions, 20 have the same SQL under a different repository filename after disregarding comments/formatting; four have similarly named but different SQL; 50 have no similarly named file. Another 33 staging records have no stored SQL statements. The repository also has deliberate no-op history markers introduced in [PR #900](https://github.com/wesship/supreme-ai-deployment-hub/pull/900), so a recorded version alone does not prove that a clean database can recreate the live schema.

## First artifact: private schema snapshot

On a trusted machine with Docker and a current Supabase CLI, set `STAGING_DATABASE_URL` securely to the staging project's direct or session-pooler Postgres URI, then run `bash scripts/staging-schema-snapshot.sh`. The command validates the project ref and writes a schema-only dump to a mode-0600 temporary file outside the Git checkout. It does not read user rows, run migrations, or alter either database. Keep the URL and dump out of GitHub logs and commits; review SQL literals and access controls before publishing anything.

Supabase documents that [`db dump` defaults to schema-only, excluding data and custom roles](https://supabase.com/docs/reference/cli/supabase-db-dump). The command deliberately does not call `db pull`, which can update remote migration history.

## Required validation before changing the integration

1. Compare the snapshot to the root migrations and capture the staging schema in an isolated `supabase/` working directory. Do not copy historical staging SQL or add no-op markers to the production-linked root directory merely to satisfy version numbers.
2. Replay that directory against a disposable preview project and verify tables, functions, grants, RLS policies and representative API queries. Resolve the 33 history entries without statements based on observed schema and reviewed source, not guessed SQL.
3. Only after replay succeeds, set the staging project's [GitHub integration working directory](https://supabase.com/docs/guides/deployment/branching/github-integration) to the tested directory. Keep production's working directory unchanged. Verify the Supabase Preview check passes on the exact PR head.

This document and its snapshot script do not modify the GitHub integration or the Supabase database. A draft PR containing them is a preparation gate, not a migration fix.
