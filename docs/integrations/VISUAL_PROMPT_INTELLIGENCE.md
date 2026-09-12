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
- Supabase persistence of visual-generation provenance on the active render ledger.

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

Example:

```json
{
  "visual_intelligence": {
    "enabled": true,
    "style_id": "cinematic-storyboard",
    "constraints": ["restrained prestige science fiction"],
    "negative_constraints": ["overly saturated neon"],
    "shot_overrides": {
      "SEQ01-SC01-SH004": {"style_id": "technical-infographic"}
    }
  }
}
```

Every generated packet keeps `original_generation_prompt`, replaces `generation_prompt`
with the compiled provider-neutral prompt when enabled, merges negative constraints, and
adds a `visual_intelligence` provenance block. Provider ordering is not changed by the
visual compiler. Unknown style IDs degrade safely to the original prompt and emit a QA
warning rather than blocking the render pipeline.

## Supabase generation persistence

The active multimodel startup dispatcher persists executable jobs in
`public.ai_film_render_jobs`. Gate 4 extends that existing owner-scoped ledger rather
than dual-writing the older `film_generation_jobs` stack.

Migration: `supabase/migrations/20260912184000_visual_generation_persistence.sql`

Added fields:

- `visual_context jsonb` — original prompt, compiled prompt, negative prompt, style ID,
  style source, compiler metadata, warnings, selected model, and packet schema;
- `cost_metadata jsonb` — provider usage and cost metadata without credentials;
- `quality_metadata jsonb` — quality scores and controlled-regeneration decisions;
- `parent_job_id uuid` — lineage pointer for regenerated or edited descendants;
- `source_subsystem text` — source namespace such as `ai_films`.

`backend/ai_films/generation_dispatch_startup.py` now populates `visual_context` when a
real render job is queued. The complete generation packet remains in `input` for worker
compatibility, while the structured provenance fields make audit, analytics, quality
scoring, and lineage queries practical.

The table retains its existing owner RLS policy. Anonymous access is explicitly revoked;
`authenticated` keeps reviewed CRUD grants and `service_role` retains backend access.
The migration was applied to the connected staging Supabase project before production
promotion. Provider secrets are never written to the ledger.

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
8. Generation lineage, cost, quality, and source metadata persist on the active render ledger.

## Next implementation gates

- Populate cost metadata from provider callbacks/workers and resulting asset references from render outputs.
- Add quality scoring and controlled regeneration policy after generation.
- Connect a future Brand Forge backend executor to the same compilation and persistence helpers.
