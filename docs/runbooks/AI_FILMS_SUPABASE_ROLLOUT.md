# AI Films Supabase Controlled Rollout

## Purpose

Deploy the AI Films Phase 3 schema and `ai-film-companion` Edge Function without enabling production model calls prematurely.

## Required GitHub environments

Create protected environments named `staging` and `production`.

Each environment must provide:

- `SUPABASE_ACCESS_TOKEN`
- `SUPABASE_PROJECT_ID`
- `SUPABASE_DB_PASSWORD`

Production should require manual approval.

## Deployment sequence

1. Run **AI Films Supabase Rollout** with `target=staging`, `mode=preview`.
2. Review the migration dry-run output and database lint results.
3. Run staging with `mode=apply`, confirmation `APPLY_AI_FILMS`, and `deploy_function=true`.
4. Leave `AI_FILM_COMPANION_ENABLED` unset or set to `false`.
5. Verify disabled requests return `FEATURE_DISABLED`.
6. Validate anonymous access cannot execute `match_ai_film_transcript`.
7. Validate authenticated users can only read published films.
8. Validate one user cannot read or modify another user's film library rows.
9. Load one approved test transcript and 1,536-dimension embeddings.
10. Enable the server variable only in staging and test retrieval, citations, latency, and cost.
11. Keep the remote `ai_film_companion` UI flag disabled until all tests pass.
12. Repeat preview and approval-gated apply for production.

## Required access tests

### Anonymous

- Published films: readable.
- Unpublished films: not readable.
- Film library: not readable or writable.
- Transcript RPC: execution denied.

### Authenticated user

- Published films: readable.
- Unpublished films: not readable by default.
- Own library row: readable and writable.
- Another user's library row: not readable or writable.
- Published transcript retrieval: available through the authenticated function path.

## Activation controls

Both controls must be enabled:

- Supabase Edge Function secret: `AI_FILM_COMPANION_ENABLED=true`
- Remote feature flag row: `ai_film_companion=true`

Enable the server control first, validate the API privately, then enable the UI flag.

## Rollback

- Immediately set `AI_FILM_COMPANION_ENABLED=false`.
- Set remote feature flag `ai_film_companion=false`.
- Do not delete migration history or reset a production database.
- Correct defects with a new forward-only migration.
- Redeploy the previous Edge Function commit if application rollback is required.

## Prohibited production actions

- Never run `supabase db reset --linked` against production.
- Never use `--include-seed` on production.
- Never expose the service-role key to frontend code.
- Never enable the UI flag before authenticated retrieval and citation tests pass.
