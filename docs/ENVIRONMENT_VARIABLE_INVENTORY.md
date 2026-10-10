# D3VONN.IO Environment Variable Inventory

Status: Phase 2 stabilization baseline
Owner: Wesley Little
Tracking: #624, #589

## Purpose

This document defines the canonical names, scope, sensitivity, and expected behavior of runtime configuration. It records names and ownership only. Never store secret values in this repository.

## Operating rules

- Production and staging credentials must come from different provider projects or accounts where isolation is supported.
- Never promote a staging secret into production.
- `SUPABASE_SERVICE_ROLE_KEY` and equivalent Supabase secret keys are server-side only.
- `SUPABASE_ACCESS_TOKEN` is a CLI/automation credential, not a backend service-role credential.
- Variables beginning with `VITE_` are client-visible and must never contain privileged credentials.
- Remove a variable only after repository usage and deployment behavior have been verified.
- Every secret requires an owner, scope, rotation date, and documented failure behavior.

## Railway backend — required runtime baseline

| Variable | Classification | Scope | Secret | Failure behavior / notes |
|---|---|---|---|---|
| `APP_ENV` | Required | staging + production | No | Must be `staging` or `production`; prevents environment ambiguity. |
| `DEBUG` | Required policy | staging + production | No | Must be false in production. |
| `ALLOWED_ORIGINS_RAW` | Required | staging + production | No | Canonical CORS variable expected by `backend/app/config.py`. Prefer this over legacy `ALLOWED_ORIGINS`. |
| `SUPABASE_URL` | Required | staging + production | No | Must match the same Supabase project as the secret key. |
| `SUPABASE_SERVICE_ROLE_KEY` | Required | staging + production backend only | Yes | Privileged server-side Supabase access. Never expose to frontend or promote across environments. |
| `JWT_SECRET` | Required where HS256 verification is active | staging + production backend only | Yes | Auth fails closed when required and invalid/missing. Confirm whether Supabase JWKS replaces this path. |
| `REQUIRE_AUTH` | Required policy | staging + production | No | Must remain true outside local development. |
| `OPENAI_API_KEY` | Required for OpenAI-backed routes | staging + production backend only | Yes | AI routes should fail clearly when absent; health should remain available. |

## Railway backend — feature-dependent variables

| Variable | Classification | Scope | Secret | Notes |
|---|---|---|---|---|
| `OPENAI_DEFAULT_MODEL` | Optional configuration | staging + production | No | Default: `gpt-4.1-mini`. |
| `OPENAI_MAX_TOKENS` | Optional configuration | staging + production | No | Default: `2048`. |
| `OPENAI_TEMPERATURE` | Optional configuration | staging + production | No | Default: `0.7`. |
| `ELEVENLABS_API_KEY` | Optional feature | backend only | Yes | Required only for ElevenLabs voice routes. |
| `ELEVENLABS_DEFAULT_VOICE_ID` | Optional feature | backend | No | Voice default. |
| `ELEVENLABS_DEFAULT_MODEL` | Optional feature | backend | No | Voice model default. |
| `ASSEMBLYAI_API_KEY` | Optional feature | backend only | Yes | Required only for transcription routes. |
| `GITHUB_TOKEN` | Optional privileged integration | backend only | Yes | Use least privilege; do not reuse personal broad-scope tokens. |
| `GITHUB_REPO` | Optional integration | backend | No | Default: `wesship/supreme-ai-deployment-hub`. |
| `N8N_API_KEY` | Optional automation | backend only | Yes | Required only when n8n integration is enabled. |
| `N8N_BASE_URL` | Optional automation | backend | No | Default: `https://n8n.d3vonn.io`. |
| `PINECONE_API_KEY` | Optional RAG/vector feature | backend only | Yes | Required when Pinecone-backed retrieval is enabled. |
| `PINECONE_HOST` | Optional RAG/vector feature | backend | No | Provider index host. |
| `PINECONE_INDEX_NAME` | Optional RAG/vector feature | backend | No | Default: `document-store`. |
| `PINECONE_DIMENSION` | Optional RAG/vector feature | backend | No | Default: `768`; must match embeddings/index. |
| `PINECONE_NAMESPACE` | Optional RAG/vector feature | backend | No | Default: `documents`. |
| `RAG_TOP_K` | Optional configuration | backend | No | Default: `5`. |
| `RAG_MIN_SCORE` | Optional configuration | backend | No | Default: `0.70`. |
| `EMBEDDING_MODEL` | Optional configuration | backend | No | Default: `text-embedding-3-small`. |
| `EMBED_BATCH_SIZE` | Optional configuration | backend | No | Default: `20`. |
| `RATE_LIMIT_PER_MINUTE` | Required policy | staging + production | No | Default: `60`. |
| `RATE_LIMIT_CHAT_PER_MINUTE` | Required policy | staging + production | No | Default: `20`. |

## W&B / Weave observability

| Variable | Classification | Scope | Secret | Notes |
|---|---|---|---|---|
| `WANDB_WEAVE_ENABLED` | Optional, fail-open | staging + production | No | Set false until valid project/entity permissions exist. |
| `WANDB_API_KEY` | Optional observability | backend only | Yes | Current staging logs show permission failure; rotate or correct team scope before enabling. |
| `WANDB_PROJECT` | Optional observability | backend | No | Repository default is `devonn-ai`; rename only through a coordinated migration. |
| `WANDB_ENTITY` | Optional observability | backend | No | Must identify an entity/team the API key can write to. |

The Railway project-level shared variable currently named `W&B` is noncanonical and should not be referenced by new code. Do not delete it until references are checked. The canonical credential name is `WANDB_API_KEY`.

## CI/CD-only credentials

These normally belong in GitHub Actions environment/repository secrets, not Railway runtime:

| Variable | Classification | Intended location | Notes |
|---|---|---|---|
| `SUPABASE_ACCESS_TOKEN` | Required for Supabase CLI workflows | GitHub Actions | Personal/automation access token beginning `sbp_`; not a service-role key. |
| `SUPABASE_PROJECT_ID` | Required for project-targeted workflows | GitHub Actions environment | Must use staging or production project reference according to environment. |
| `SUPABASE_DB_PASSWORD` | Migration/admin only | GitHub Actions environment | Not required for ordinary HTTP API runtime unless code explicitly opens a direct DB connection. |
| `CODECOV_TOKEN` | Optional CI reporting | GitHub Actions | Coverage upload only. |
| `E2E_TEST_EMAIL` | Certification-only | GitHub Actions production environment | Dedicated low-privilege audit identity. |
| `E2E_TEST_PASSWORD` | Certification-only | GitHub Actions production environment | Rotate if exposed; dedicated low-privilege identity only. |

The repository security controls are defined in [Open-Source Security Baseline](security/OPEN_SOURCE_SECURITY_BASELINE.md); they do not require a third-party scanner credential.

## Known legacy or review-required names

| Name | Status | Action |
|---|---|---|
| `ALLOWED_ORIGINS` | Likely legacy | Compare live value with `ALLOWED_ORIGINS_RAW`; migrate through a tested PR before removal. |
| `W&B` | Noncanonical shared variable | Determine whether anything references it. Replace with `WANDB_API_KEY` only after verification. |
| `DATABASE_URL` | Architecture-dependent | Keep only if a direct Postgres pool is intentionally used. Staging currently logs `backend.db.pool not found — skipping DB pool init`; classify before deletion. |
| `SUPABASE_ANON_KEY` | Architecture-dependent backend variable | Keep only for routes that explicitly need public/anon access; never substitute for service-role key. |
| `AI_FILM_EMAIL_FROM` | Feature-dependent | Preserve while AI Film email delivery is enabled; add owner/provider documentation. |

## Current staging evidence

- Railway staging service contains 34 service variables.
- `SUPABASE_SERVICE_ROLE_KEY` was replaced with a key from the staging Supabase project.
- The resulting Railway deployment became active and `/health` returned HTTP 200.
- Privileged Supabase route verification is still required.
- W&B/Weave initialization currently fails permission checks but is fail-open and does not block API health.
- Direct database-pool initialization was skipped; confirm whether this is expected architecture.

## Inventory completion checklist

- [ ] Export or transcribe all 34 Railway staging variable names without values.
- [ ] Map every name to this document: required, optional, legacy, duplicate, or unknown.
- [ ] Compare staging names with production names without copying secret values.
- [ ] Confirm `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` belong to the same staging project.
- [ ] Execute one privileged Supabase-backed staging operation.
- [ ] Decide whether direct `DATABASE_URL`/pool support is intentional.
- [ ] Disable W&B in staging or correct `WANDB_API_KEY`, `WANDB_ENTITY`, and `WANDB_PROJECT` permissions.
- [ ] Add owner and rotation date to the private secret register tracked by #589.
- [ ] Remove only variables proven unused through code search and deployment validation.
