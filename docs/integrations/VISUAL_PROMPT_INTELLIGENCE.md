# Visual Prompt Intelligence

D3VONN's visual prompt intelligence layer sits before image and video providers.
It converts loose creative intent into deterministic prompt fragments, constraints,
negative constraints, and metadata without coupling orchestration to a single vendor.

## Runtime flow

`Hermes / Brand Forge / AI Films -> VisualStyleLibrary -> provider router -> generator -> asset store`

The implementation lives under `backend/visual_intelligence/` and provides:

- a native D3VONN seed catalog;
- deterministic style lookup and search;
- provider-neutral prompt and negative-prompt compilation;
- compiler/style/source metadata;
- a pinned upstream catalog importer;
- authenticated FastAPI endpoints for catalog status, style search, catalog loading,
  and prompt compilation;
- runtime generation integration for AI Films;
- Supabase persistence of visual-generation provenance on the active render ledger;
- provider-result, asset, QA, and bounded-regeneration lifecycle persistence;
- bounded provider/style performance feedback for video routing.

## awesome-gpt-image-2 upstream pin

The public `freestylefly/awesome-gpt-image-2` project is an MIT-licensed prompt-as-code
catalog. D3VONN consumes it as an import source rather than copying its website or
binding production generation directly to its repository structure.

Reviewed source:

`freestylefly/awesome-gpt-image-2@0dc09c46c8a30b1fdd89c18cc78a894dac2104e3`

Catalog path:

`data/style-library.json`

The importer only fetches this immutable raw URL, applies a strict response-size cap,
normalizes industrial templates into D3VONN `VisualStyle` records, and preserves source
attribution on every imported record. Any future upstream update requires a code review
that changes the pin.

## Authenticated API

The router is registered beneath `/api/visual` and uses the existing Supabase JWT
`get_current_user_id` dependency.

- `GET /api/visual/source` — reviewed upstream pin and current in-process catalog status.
- `GET /api/visual/styles?q=<query>&limit=<n>` — deterministic style discovery.
- `POST /api/visual/catalog/load` — fetch and normalize the pinned upstream catalog.
- `POST /api/visual/compile` — compile intent and constraints into a provider-neutral prompt.

## AI Films runtime integration

`backend/ai_films/shot_compiler.py` resolves optional visual policy from
`ProductionBible.generation_policy.visual_intelligence` before provider routing.

Every generated packet keeps `original_generation_prompt`, replaces `generation_prompt`
with the compiled provider-neutral prompt when enabled, merges negative constraints, and
adds a `visual_intelligence` provenance block. Unknown style IDs degrade safely to the
original prompt and emit a QA warning rather than blocking the render pipeline.

## Supabase generation persistence

The active multimodel startup dispatcher persists executable jobs in
`public.ai_film_render_jobs`. Gate 4 extends that existing owner-scoped ledger rather
than dual-writing the older `film_generation_jobs` stack.

Migration: `supabase/migrations/20260912184000_visual_generation_persistence.sql`

Core provenance fields:

- `visual_context jsonb` — original prompt, compiled prompt, negative prompt, style ID,
  style source, compiler metadata, warnings, selected model, and packet schema;
- `cost_metadata jsonb` — provider-reported usage/cost metadata without credentials;
- `quality_metadata jsonb` — QA evidence and controlled-regeneration decisions;
- `parent_job_id uuid` — lineage pointer for regenerated or edited descendants;
- `source_subsystem text` — source namespace such as `ai_films`.

Gate 5 adds explicit result and regeneration fields with
`supabase/migrations/20260912190000_visual_generation_lifecycle.sql`:

- `result_asset_id uuid` — generated `ai_film_assets` record;
- `result_storage_path text` — private storage object path, never a signed URL;
- `regeneration_count integer` — bounded regeneration depth.

OpenAI/Sora and Pollo completion workers write the generated asset reference, private
storage path, and provider-reported usage/cost fields when a render completes. They never
invent a price when the provider response omits one. Provider result URLs are not kept as
the durable asset reference; private D3VONN storage remains authoritative.

`backend/ai_films/generated_shot_qa_worker.py` claims any completed video render marked
`pending_generated_qa`, so Pollo and future compatible video workers use the same
TwelveLabs/Jockey QA path. A `revise` decision can create a child render job linked by
`parent_job_id`, but only when both `AI_FILM_AUTO_REGEN_ENABLED=true` and
`AI_FILM_GENERATION_EXECUTION_ENABLED=true`. `AI_FILM_AUTO_REGEN_MAX` bounds the chain
and defaults to one regeneration. `pass` and `block` never auto-regenerate.

## Gate 6 provider/style performance feedback

`backend/ai_films/provider_performance.py` summarizes recent completed render QA by
provider and by provider/style pair. The production startup planner reads up to the most
recent 200 completed video jobs and passes that snapshot to video routing.

Routing feedback is deliberately conservative:

- at least three eligible QA outcomes are required before any adjustment;
- pass/revise/block rates and QA confidence are the only inputs in this gate;
- a style-specific signal is used only when that provider/style pair has at least three samples;
- each observed-performance adjustment is capped to `-15..+15` points;
- the signal can reorder already executable/configured providers but can never make an
  unconfigured or non-executable provider runnable;
- worker admission remains controlled by `AI_FILM_EXECUTABLE_VIDEO_PROVIDERS` and the
  provider's required credentials/configuration.

Pollo is the verified non-OpenAI production video worker currently present in this repo.
xAI, Replicate, Higgsfield, Runway, and Movieflow remain provider-routing candidates only
until a corresponding execution worker and canary are verified and explicitly admitted.
The connected staging project currently has no completed video jobs with structured QA
outcomes, so the observed-performance adjustment is presently zero and baseline routing
remains unchanged until enough evidence accumulates.

The table retains its existing owner RLS policy. Anonymous access remains revoked;
`authenticated` keeps reviewed CRUD grants and `service_role` retains backend access.
Gate 4 and Gate 5 migrations were applied to the connected staging Supabase project
before production promotion. Gate 6 requires no schema migration. Provider secrets are
never written to the ledger.

## Brand Forge contract

Brand Forge's visual-generation stage explicitly requires approved intent to pass
through D3VONN Visual Prompt Intelligence before its image provider executes. The stage
records the compiled prompt and compiler metadata alongside generated asset provenance.
The current Brand Forge layer is a workflow/marketplace contract; a dedicated backend
Brand Forge executor does not yet exist in this repository, so no fictitious runtime
hook was added.

## Integration rules

1. Provider credentials remain server-side.
2. Style selection happens before provider routing.
3. User constraints augment selected style guidance.
4. Imported styles retain source attribution and immutable source commit metadata.
5. The runtime never accepts an arbitrary catalog URL from a user.
6. Original and compiled prompts remain separately auditable.
7. Provider-specific features belong in adapters, not in the style catalog.
8. Generation lineage, result assets, cost/usage, quality, and source metadata persist on the active render ledger.
9. Automatic regeneration is opt-in, execution-gated, and depth-bounded.
10. Observed performance may nudge routing only within explicit worker/configuration gates.

## Next implementation gates

- Add execution reliability, latency, and normalized provider-cost signals to routing analytics.
- Add worker + canary admission for additional video providers before making them executable.
- Connect a future Brand Forge backend executor to the same compilation and persistence helpers.
