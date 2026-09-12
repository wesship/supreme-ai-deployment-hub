# AI Films Routing Outcome Correlation

Gate 13 closes the loop between the immutable routing decision captured at dispatch and the observed result of that same render job.

## Correlation contract

Provider Intelligence reads both sides from the existing owner-scoped `ai_film_render_jobs` row:

- **Decision evidence:** versioned `input.routing_decision` persisted by Gate 11.
- **Outcome evidence:** current job status, `quality_metadata`, `started_at`, `completed_at`, `regeneration_count`, `parent_job_id`, `cost_metadata`, and `result_asset_id`.

The join key is the render-job row itself. No heuristic matching by shot, provider, timestamp, or asset name is used.

## Operator evidence

The Gate 12 routing drill-down now adds a `Dispatch → outcome` panel showing:

- current job status;
- final QA decision (`pass`, `revise`, `block`, or pending);
- QA confidence when reported;
- render latency when both timestamps exist;
- provider-reported cost when present;
- regeneration state and depth;
- linked result asset ID;
- completion timestamp.

A passing QA result is labeled `choice validated`. Revise/block or a failed job is labeled `needs review`. Incomplete jobs remain `outcome pending`.

## Safety and semantics

- Historical routing evidence is never recomputed from current provider configuration or scoring rules.
- Outcome evidence may advance as the same job progresses, but it cannot rewrite the persisted dispatch snapshot.
- Missing QA, latency, cost, completion, or asset evidence remains explicitly missing/pending; values are not estimated.
- Cost continues to come only from the render ledger's provider cost metadata.
- The browser query remains authenticated and owner-scoped by existing RLS.
- No service-role credential, provider token, signed asset URL, generation prompt, or private storage path is exposed by this panel.
- Gate 13 is read-only and requires no database migration.

## Result

D3VONN can now answer both halves of an AI Films routing audit:

1. **Why did this provider win?** — immutable Gate 11 decision evidence.
2. **What happened after it won?** — same-job Gate 13 QA, latency, regeneration, asset, and reported-cost evidence.

This correlation is evidence for operators and future policy evaluation. It does not automatically change provider activation or routing policy.
