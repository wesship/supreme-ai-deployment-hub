# Visual Prompt Intelligence

D3VONN's visual prompt intelligence layer sits before image and video providers.
It converts loose creative intent into deterministic prompt fragments, constraints,
negative constraints, and metadata without coupling orchestration to a single vendor.

## Runtime flow

`Hermes / Brand Forge / AI Films -> VisualStyleLibrary -> provider activation gate -> provider router -> routing audit snapshot -> generator -> asset store -> QA -> provider intelligence`

The implementation lives under `backend/visual_intelligence/` and the AI Films lifecycle modules. It provides:

- a native D3VONN seed catalog;
- deterministic style lookup and search;
- provider-neutral prompt and negative-prompt compilation;
- compiler/style/source metadata;
- a pinned upstream catalog importer;
- authenticated FastAPI endpoints for catalog status, style search, catalog loading, and prompt compilation;
- runtime generation integration for AI Films;
- Supabase persistence of visual-generation provenance on the active render ledger;
- provider-result, asset, QA, and bounded-regeneration lifecycle persistence;
- bounded provider/style performance feedback for video routing;
- fail-closed provider activation certification;
- an owner-scoped Provider Intelligence workspace in AI Film Studio;
- first-class Replicate general-video worker support behind explicit certification;
- matched-window trend and provider-reported approval-cost analytics;
- per-job routing-decision audit snapshots, operator drill-down, same-job outcome correlation, and decision-quality rollups.

## awesome-gpt-image-2 upstream pin

Reviewed source: `freestylefly/awesome-gpt-image-2@0dc09c46c8a30b1fdd89c18cc78a894dac2104e3`

Catalog path: `data/style-library.json`

The importer only fetches this immutable raw URL, applies a strict response-size cap,
normalizes industrial templates into D3VONN `VisualStyle` records, and preserves source
attribution on every imported record. Any future upstream update requires a code review
that changes the pin.

## Authenticated API

The visual router is registered beneath `/api/visual` and uses the existing Supabase JWT auth dependency.

- `GET /api/visual/source`
- `GET /api/visual/styles?q=<query>&limit=<n>`
- `POST /api/visual/catalog/load`
- `POST /api/visual/compile`

## AI Films runtime integration

`backend/ai_films/shot_compiler.py` resolves optional visual policy from
`ProductionBible.generation_policy.visual_intelligence` before provider routing.
Every generated packet keeps `original_generation_prompt`, stores the compiled prompt separately,
merges negative constraints, and records a `visual_intelligence` provenance block.

## Supabase generation persistence

Gate 4 migration: `supabase/migrations/20260912184000_visual_generation_persistence.sql`

Gate 5 migration: `supabase/migrations/20260912190000_visual_generation_lifecycle.sql`

The active `public.ai_film_render_jobs` ledger carries visual provenance, cost metadata,
quality metadata, result asset linkage, private storage path, parent lineage, and bounded
regeneration depth. Existing owner-scoped RLS remains authoritative.

## Provider lifecycle

Pollo, OpenAI, and the Gate 9 Replicate general-video worker normalize result assets and
provider-reported usage/cost. Generated video is stored privately, linked to `ai_film_assets`,
and then enters the TwelveLabs/Jockey QA path. QA records pass/revise/block, confidence,
reasons, canon violations, and revision prompts. Automatic regeneration stays opt-in and depth-bounded.

## Observed performance routing

`backend/ai_films/provider_performance.py` summarizes recent completed render QA by provider
and provider/style pair. Routing feedback is conservative: at least three QA outcomes are
required and each observed-performance adjustment is capped to `-15..+15` points.
Observed evidence can only reorder already admitted providers; it never activates one.

## Fail-closed provider activation

`backend/ai_films/provider_activation.py` requires explicit provider request, a concrete
worker implementation, and production canary certification. Pollo is the certified baseline.
OpenAI requires an explicit canary-pass flag for reactivation. Replicate now has a first-class
general-video worker but remains non-executable until `AI_FILM_PROVIDER_CANARY_REPLICATE=pass`
and `replicate` is explicitly included in `AI_FILM_EXECUTABLE_VIDEO_PROVIDERS`. xAI,
Higgsfield, Runway, and Movieflow remain non-executable until their own worker and canary are certified.

## Gate 9 Replicate general-video certification

`backend/ai_films/replicate_video_worker.py` promotes the existing Replicate Seedance capability
from fallback-only execution into a first-class general-video worker. The worker reuses the
existing private storage and asset registration path, records provider-reported cost metadata,
and hands completed assets into `pending_generated_qa`.

The normal queue runner remains fail-closed through `activation_status("replicate", source)`.
A provider token, model name, routing preference, or performance score alone cannot make the
worker claim jobs.

Certification is intentionally separate from runtime activation:

- `.github/workflows/ai-films-replicate-video-canary.yml` is manual-only;
- it requires the literal confirmation `RUN_REPLICATE_VIDEO_CANARY`;
- it runs in the protected production environment;
- it creates exactly one five-second neutral test render;
- automatic regeneration and normal generation execution are disabled for the canary job;
- the script verifies completed ledger state, private project storage, result-asset linkage, and QA handoff;
- a successful canary does not change routing flags automatically.

The paid certification canary must be run and reviewed separately before protected runtime configuration
is changed to admit Replicate.

## Gate 8–10 Provider Intelligence workspace

`src/features/ai-films/providerIntelligenceService.ts` reads the signed-in owner's
`ai_film_render_jobs` through the existing Supabase browser client and RLS. No service-role key
is exposed to the browser and no new schema is required.

`src/features/ai-films/ProviderIntelligenceWorkspace.tsx` is mounted in AI Film Studio and shows:

- sampled video jobs and QA outcomes;
- provider pass, failure, revise/block and regeneration evidence;
- mean render latency when timestamps exist;
- provider-reported cost totals only when a provider actually reports cost;
- observed visual styles and style/provider QA evidence;
- the bounded routing nudge derived from the same scoring contract used by routing;
- selectable 7/30/90-day windows;
- matched previous-period pass/failure deltas;
- provider-reported cost per QA-approved shot;
- explicit cost-reporting coverage so incomplete billing data is visible rather than silently extrapolated.

The workspace is read-only. It does not mutate provider configuration, canary state, routing,
credentials, jobs, or assets. Fewer than three QA outcomes always produce a zero routing adjustment.
Missing provider billing data is never estimated.

## Gate 11 routing-decision audit snapshot

Every newly queued AI Films generation job stores a versioned, secret-free
`input.routing_decision` snapshot beside the generation packet. The snapshot captures the exact
evidence available at dispatch time so later configuration or scoring changes cannot rewrite history.

The audit record includes:

- selected provider and model;
- selected route and every ranked alternative;
- provider base score and final score;
- bounded observed-performance adjustment;
- configuration state;
- activation request state, worker availability, canary pass state, and final certification state;
- routing reasons for every provider;
- visual style ID/source used by the decision;
- dispatcher version and decision timestamp.

No provider credentials, API keys, tokens, auth headers, or signed asset URLs are copied into the
audit snapshot. Gate 11 uses the existing render-job `input` JSON and therefore requires no schema change.
The snapshot is audit evidence only; it does not alter provider ranking or execution eligibility.

## Gate 12 routing audit drill-down

Provider Intelligence reads the persisted `input.routing_decision` snapshot from the same
owner-scoped render-job query and exposes up to the 20 most recent audited decisions in the selected
7/30/90-day window.

Each expandable decision shows selected provider/model, shot ID, decision time and reason,
style provenance, route scoring, activation evidence, exact winning reasons, and every ranked alternative.
Historical decisions are never recomputed with current routing rules.

## Gate 13 dispatch-to-outcome correlation

Each Gate 11 decision is correlated with the outcome fields on the exact same render-job row.
The drill-down shows current job status, final QA pass/revise/block or pending state, QA confidence,
render latency, provider-reported cost, regeneration state/depth, result asset linkage, and completion time.
The render job itself is the join key; there is no heuristic matching by provider, shot, or timestamp.
Missing outcome evidence stays missing rather than being fabricated.

## Gate 14 decision-quality rollups

Provider Intelligence now aggregates audited top-ranked choices into read-only decision-quality rollups.
The rollups answer whether the provider D3VONN selected actually produced a good outcome, while keeping
routing unchanged.

Rollups are available at three levels:

- overall audited routing decisions;
- selected provider;
- selected provider × visual style.

For each group the workspace shows:

- audited decision count;
- judged decision count and pending count;
- pass, revise, block, and explicit render-failure rates;
- outcome-evidence coverage;
- mean QA confidence where reported;
- mean render latency where timestamps exist;
- mean provider-reported cost where cost exists;
- explicit provider-cost coverage.

A decision is judged only when it has terminal QA evidence (`pass`, `revise`, `block`) or an explicit
render failure/error. Incomplete decisions remain pending. A provider or provider/style group requires at
least three judged decisions before it is labeled `evidence sufficient`; smaller groups are labeled sparse.
This threshold is only an operator-facing evidence-quality label and does not change routing, activation,
provider admission, canary state, or spend. Cost and latency gaps are never imputed.

## Brand Forge contract

Brand Forge's visual-generation stage requires approved intent to pass through Visual Prompt
Intelligence before its provider executes and records the compiled prompt and provenance.
A dedicated backend Brand Forge executor still does not exist, so no fictitious runtime hook was added.

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
10. Observed performance may nudge routing only within explicit worker/configuration/canary gates.
11. Provider Intelligence is read-only and owner-scoped by existing RLS.
12. New video providers remain non-executable until a bounded production canary is separately reviewed and activated.
13. Cost-efficiency analytics use reported costs only and expose data coverage.
14. Every queued generation job preserves the routing evidence that selected its provider without copying secrets.
15. Historical routing explanations come only from persisted decision snapshots and are never reconstructed from current rules.
16. Decision-quality rollups are observational only, separate sparse evidence from sufficient evidence, and cannot activate or re-rank providers.

## Next implementation gates

- Run and review the protected Replicate general-video certification canary before any activation change.
- Add calibrated recommendation thresholds so decision-quality evidence can propose, but not automatically apply, routing policy changes.
- Connect a future Brand Forge backend executor to the same compilation and persistence helpers.
