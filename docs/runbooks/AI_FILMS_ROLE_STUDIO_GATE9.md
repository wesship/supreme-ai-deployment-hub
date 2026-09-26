# AI Films Role Studio Gate 9 — read path

This change adds a disabled-by-default, owner-authenticated read endpoint for published role profiles. It does not activate a public avatar, create role releases, or connect the Gate 7 prototype UI.

## Staging sequence

1. Preview `20260924180000_ai_film_role_releases.sql` against staging, inspect database lint and privileges, then apply through the governed migration workflow. Do not apply it directly to production.
2. Confirm `anon` and `authenticated` have no table grants and a role release cannot be updated except for one-time revocation. Confirm an unauthorized caller cannot read a project role.
3. Implement the writer workflow with verified worker test IDs, distinct editor/reviewer/publisher, and a server-side transaction before inserting a release. This PR intentionally provides no public write endpoint.
4. Insert one approved staging profile through the governed writer, verify its canonical SHA-256, and set `AI_FILMS_ROLE_STUDIO_ENABLED=true` only in staging.
5. With a project owner's valid Supabase bearer token, fetch `GET /api/ai-films/roles/{project_id}/{role_id}/published`. Verify the returned `role_id`, `version`, `profile_hash` and allowed tools. Anonymous and non-owner calls must fail; the mental health role must fail closed.
6. Have Hermes pin the returned version and hash at session creation and enforce the tool allowlist when executing tools. Do not treat the frontend profile as trusted.

## Evidence and rollback

Local unit command: `python3 -m unittest discover -s tests/ai_films -p test_role_runtime.py -v`.

If staging verification fails, turn off `AI_FILMS_ROLE_STUDIO_ENABLED`. The migration creates only a new table and trigger. Do not mark Gate 9 GREEN until the writer, authorization checks and an end-to-end staging session pass.
