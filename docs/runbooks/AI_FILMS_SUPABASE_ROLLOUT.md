# AI Films Supabase Controlled Rollout

## Purpose

Deploy the AI Films Phase 3 schema and `ai-film-companion` Edge Function without enabling production model calls prematurely.

## Required GitHub environments

Create protected environments named `staging` and `production`.

Each environment must provide these values under **Environment secrets**, not Environment variables:

- `SUPABASE_ACCESS_TOKEN` — a Supabase personal access token
- `SUPABASE_PROJECT_ID` — the target project's reference ID
- `SUPABASE_DB_PASSWORD` — the target project's database password

Configure them at **Repository Settings → Environments → target environment → Environment secrets**. The workflow reports every missing secret by name without printing secret values.

Production must require manual approval. Never store these values in the workflow, repository files, workflow-dispatch inputs, issue comments, or pull-request comments.

## Deployment sequence

1. Confirm the three required secret names appear in the target GitHub environment.
2. Run **AI Films Supabase Rollout** with `target=staging`, `mode=preview`.
3. Review the migration dry-run output and database lint results.
4. Run staging with `mode=apply`, confirmation `APPLY_AI_FILMS`, and `deploy_function=true`.
5. Leave `AI_FILM_COMPANION_ENABLED` unset or set to `false`.
6. Verify disabled requests return `FEATURE_DISABLED`.
7. Validate anonymous access cannot execute `match_ai_film_transcript`.
8. Validate authenticated users can only read published films.
9. Validate one user cannot read or modify another user's film library rows.
10. Load one approved test transcript and 1,536-dimension embeddings.
11. Enable the server variable only in staging and test retrieval, citations, latency, and cost.
12. Keep the remote `ai_film_companion` UI flag disabled until all tests pass.
13. Repeat preview and approval-gated apply for production.

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
