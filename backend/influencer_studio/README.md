# D3VONN Influencer Studio

Provider-neutral synthetic-persona campaign production governed by Hermes.

## Certified boundary

The initial production gate intentionally stops at `READY_TO_PUBLISH`.

That boundary proves:

1. owner-scoped persona creation,
2. campaign creation,
3. canonical Hermes goal/task binding,
4. provider media dispatch,
5. provider-job refresh,
6. generation provenance,
7. rights/provenance certification,
8. QA certification,
9. explicit human approval, and
10. a durable `READY_TO_PUBLISH` campaign state.

It does **not** automatically publish to a social platform, automate customer DMs, or execute monetization.

## Runtime components

- `models.py` — Persona and deterministic Campaign state machine.
- `repositories.py` — in-memory and owner-scoped Supabase repositories.
- `assets.py` — generated-asset provenance/certification ledger with optional AI Films asset linkage.
- `providers.py` — provider-neutral media contract and capability registry.
- `external_providers.py` — Eromify remote MCP adapter and ComfyUI/Wan HTTP adapter.
- `hermes_bridge.py` — audited lifecycle events into the canonical Hermes event sink.
- `runtime.py` — end-to-end orchestration through `READY_TO_PUBLISH`.
- `router.py` — governed FastAPI surface at `/api/influencer-studio`.
- `src/pages/InfluencerStudio.tsx` — private-pilot operator workspace.

## Persistence

Migration:

`supabase/migrations/20261003171500_influencer_studio.sql`

Tables:

- `influencer_personas`
- `influencer_campaigns`
- `influencer_campaign_assets`

All three tables use authenticated owner-scoped RLS. Persona age is constrained to 21+, synthetic disclosure must remain true, and asset certification defaults fail closed.

Generated campaign assets may link to the existing `ai_film_assets` ledger. The runtime verifies that any linked AI Films asset is owned by the same campaign owner.

## Hermes integration

Planning creates canonical records in:

- `hermes_goals`
- `hermes_tasks`

Campaigns retain the resulting goal/task IDs. Lifecycle changes emit `influencer_studio.*` events through the existing Hermes event sink instead of creating a second orchestration ledger.

## Providers

### Eromify

Current public Eromify MCP documentation exposes a remote MCP endpoint and supports personal Bearer keys for scripts.

Environment:

```text
EROMIFY_MCP_URL=https://api.eromify.in/mcp
EROMIFY_API_KEY=<server-side-personal-api-key>
```

The adapter performs MCP initialization, session handling, `tools/list` discovery, and `tools/call`. Tool names are not hard-coded; capability matching happens against the live server tool catalog.

### ComfyUI / Wan

Environment:

```text
COMFYUI_BASE_URL=http://127.0.0.1:8188
COMFYUI_BEARER_TOKEN=
```

The adapter submits API-format ComfyUI workflows through `/prompt`, probes `/system_stats`, and refreshes jobs from `/history/{prompt_id}`.

D3VONN intentionally does not invent a Wan node graph. The exact API-format workflow must be supplied and versioned as a campaign input, keeping model/node changes explicit and reproducible.

## API sequence

```text
POST /api/influencer-studio/personas
POST /api/influencer-studio/campaigns
POST /api/influencer-studio/campaigns/{id}/plan
POST /api/influencer-studio/campaigns/{id}/generate
POST /api/influencer-studio/campaigns/{id}/assets/{asset_id}/refresh
POST /api/influencer-studio/campaigns/{id}/qa
PATCH /api/influencer-studio/campaigns/{id}/assets/{asset_id}/certify
POST /api/influencer-studio/campaigns/{id}/approval
POST /api/influencer-studio/campaigns/{id}/ready
GET  /api/influencer-studio/providers/{provider_name}/probe
GET  /api/influencer-studio/campaigns/{id}
```

Initial access uses the existing OCC admin/operator authentication boundary for a controlled private pilot.

## Required controls

- Synthetic disclosure is mandatory.
- Persona declared age must be 21+.
- Persona reference assets require provenance.reference_rights_verified=true.
- Generation reference assets require options.reference_rights_verified=true.
- Imported/reference assets require rights/provenance certification.
- Provider outputs retain provider and request provenance.
- Provider jobs must reach `succeeded` before QA.
- Every campaign asset must pass QA and rights verification before approval.
- Human approval is mandatory before `READY_TO_PUBLISH`.
- External publishing is disabled in this gate.

## Lifecycle

```text
DRAFT
  -> PLANNING
  -> GENERATING
  -> QA
  -> APPROVAL
  -> READY_TO_PUBLISH
```

The state machine also defines later controlled states:

```text
SCHEDULED -> PUBLISHED -> MEASURING -> OPTIMIZING -> COMPLETED
```

Those later states exist in the contract but are not automatically executed by the current private-pilot runtime.
