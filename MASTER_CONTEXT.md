# D3VONN.IO — Canonical AI Context

**Context version:** 2026-08-09  
**Repository:** `wesship/supreme-ai-deployment-hub`  
**Authority:** current `main` source, migrations, manifests, and governed runbooks

This is the compact source-of-truth document for Hermes, DKOS, repository-aware agents, and maintainers. The DKOS Knowledge API treats `MASTER_CONTEXT.md` as required context when it is present in generated artifacts.

## Truth and recency rules

1. Current source code and migrations on `main` outrank summaries in this file.
2. Runtime health/telemetry outrank repository intent for whether a deployed capability is actually healthy.
3. Draft or unmerged pull requests are **pending**, never production truth.
4. User/account statements about external configuration may be recorded as operator-reported state, but must be reverified before deployment or security decisions.
5. Never place secret values, access tokens, private keys, passwords, or service-role credentials in knowledge documents, prompts, logs, or frontend code.
6. When a statement becomes stale, update or supersede it; do not silently preserve contradictory facts.

## Product identity

- Product name: **D3VONN.IO**.
- Primary public domain: **https://d3vonn.io**.
- Product direction: AI Business Operating System for supervised multi-agent execution, automation, persistent knowledge, governed operations, and command-center visibility.
- Authenticated platform repository: this repository.
- Hermes is the orchestration layer. Specialized agents/workers perform governed work.
- DKOS is the knowledge/memory ingestion and retrieval track.
- Supabase is used for governed persistence and RLS-backed data.
- The production backend entrypoint in the repository is FastAPI-based and Railway-oriented.
- The web application is React/TypeScript and deployed through the D3VONN web deployment track.

## Canonical architecture on main

### Hermes and agents

Hermes provides orchestration and runtime-ledger concepts. Existing migrations and runtime code include Hermes goals/tasks/events/checkpoints/interrupts and worker/runtime persistence tracks. The agent layer includes governance, policy, and tool-registry boundaries.

Agents should treat authorization, RLS, approval gates, policy-as-code, CI/security checks, and human-in-the-loop controls as architectural requirements rather than optional features.

### DKOS / knowledge

The implemented Knowledge API is under `backend/knowledge/router.py` and exposes:

- `GET /api/knowledge/status`
- `GET /api/knowledge/search`
- `GET /api/knowledge/entity/{identifier}`
- `GET /api/knowledge/related/{identifier}`
- `GET /api/knowledge/graph`
- `POST /api/knowledge/context`

The router expects generated DKOS artifacts, especially `dkos_index.json`. It gives priority to `MASTER_CONTEXT.md`, `SYSTEM_PROMPT.md`, constitution-category documents, and agent-specific entries when assembling context.

Important operational distinction: the Knowledge API and ingestion contracts exist in `main`, but DKOS freshness still depends on artifact generation/ingestion and runtime configuration. Repository documentation alone must not be interpreted as proof that the deployed index is current.

The intended document pipeline is:

`upload -> security scan -> classification/OCR -> Docling -> MarkItDown -> Markdown cleanup -> metadata -> knowledge graph -> semantic chunks -> embeddings -> Pinecone -> Hermes memory -> DKOS retrieval -> agents`.

### Web/platform surfaces

Current `main` routes include core surfaces for AI Films, agents/AI workforce, workflows, deployment/API management, DKOS ingestion, PRIMETIME, Command Center/OCC, security operations, Secrets Vault, MoneyHub, Research OS, pricing, resources, and other D3VONN workspaces.

Presence of a route is not proof that every backing integration is production-ready. Runtime and feature-flag status must be checked independently.

## AI Films — The Sovereign Signal

AI Films is a real subsystem in this repository, not a placeholder.

Canonical project data on `main`:

- Project: **The Sovereign Signal**
- Project ID: `b2979e7c-1d28-4024-bf4f-8db90c174d5a`
- Batch: `sovereign-signal-batch-001`
- TwelveLabs knowledge store: `ks_019fd5ef-bdae-7462-88ca-f6690188521c`
- Canonical ingestion manifest: `backend/ai_films/manifests/sovereign_signal_batch_001.json`
- Manifest size: **38 assets total — 23 Google Drive assets and 15 MovieFlow assets**

Implemented server-side ingestion paths include:

- MovieFlow render ingestion into TwelveLabs.
- TwelveLabs Google Drive connector ingestion.
- A direct Google Drive -> temporary Railway storage -> TwelveLabs fallback when native Drive ingestion cannot consume an otherwise authorized file.
- Persistence of provider asset/item IDs and ingestion state in AI Films project/asset metadata.
- TwelveLabs search/reasoning integration and Jockey-oriented corpus reasoning.
- Production-bible, canon, shot compilation, generation-dispatch, anchor-frame, generated-shot QA, assembly, and post-render QA tracks.

The direct Drive fallback uses ephemeral files and deletes them after the provider upload attempt.

Required secret names include `TWELVELABS_API_KEY`, `TWELVELABS_KNOWLEDGE_STORE_ID`, Supabase server credentials, and provider-specific keys. Store only the names in source control, never their values.

The Railway application has logic for Sovereign Signal bootstraps and AI Films workers. Bootstrap execution is environment/enablement dependent; code presence must not be reported as successful ingestion without runtime evidence.

### Sovereign Signal creative canon

Creative canon is implemented in the AI Films canon/production-bible code. Agents generating or reviewing film material must consult those canonical files before inventing character, wardrobe, event, sound, or continuity details.

Current high-level canon includes Legend as the protagonist/Signal Carrier, Nana as the matriarch anchor, Jihad as Legend's brother, FBI agent Bisa Fuse, Detective Smith, the locked Instance Event `SS-IE-J/L-001`, and the Sovereign Signal frequency/sound architecture. Where this summary conflicts with `src/lib/film/canon.ts` or `backend/ai_films/production_bible.py`, the code canon wins.

## Integrations and boundaries

### TwelveLabs / Jockey

TwelveLabs integration is implemented behind authenticated server routes. Jockey is treated as a provider/research-preview capability and its API contract must be revalidated before major-version upgrades.

### MovieFlow

MovieFlow material is represented as AI Films source assets and is part of the Sovereign Signal ingestion manifest. MovieFlow external account/project state is not inferred from the repository; runtime ingestion metadata is the evidence for indexed state.

### Google Drive

The AI Films backend contains a TwelveLabs-backed Google Drive connector flow and a controlled direct-download fallback. Access remains authorization-dependent. Do not create public media URLs merely to bypass access controls.

### OpenAI, ElevenLabs and other providers

Provider integrations are server-side and must use protected environment configuration. Billing/account activation is external state and should be health-checked before production model calls. Never expose provider credentials via `VITE_*`, browser storage, public tables, client logs, or API responses.

## Security and governance

- Secrets Vault is an admin-protected surface.
- Service-role credentials remain server-only.
- RLS/tenant boundaries are mandatory for user-scoped data.
- Production migrations are forward-only and approval-gated.
- Production release state must be distinguished from staging/draft work.
- Signed asset URLs, redaction, rate/cost controls, idempotency, provider timeouts/circuit breakers, and human approval are required controls for production AI media execution.
- Never treat an unmerged PR as deployed behavior.

## Current work that is not production truth

As of this context version, repository activity includes draft/unmerged work such as MoneyHub completion, PRIMETIME staging, and Genesis certification/synchronization work. These branches can be inspected as proposals, but agents must not fold them into canonical `main` behavior until merged and, where relevant, deployed.

## Known recency gaps to verify

Before claiming end-to-end production readiness, obtain runtime evidence for the relevant subsystem:

- latest deployed commit/revision;
- `/api/health` and deployment health;
- DKOS artifact/index freshness;
- Hermes worker intake/claim/callback/write-back;
- Supabase migration/readiness state;
- AI Films worker states and per-asset ingestion metadata;
- TwelveLabs knowledge-store item readiness;
- external provider availability/billing;
- protected environment secrets by **presence only**, never value.

## Agent retrieval policy

For D3VONN questions, retrieve in this order:

1. `MASTER_CONTEXT.md`
2. directly relevant current source/migrations/manifests on `main`
3. subsystem runbooks and architecture docs
4. runtime health/telemetry when the question concerns deployment state
5. external provider documentation/status when the question concerns a third-party service

Attach source paths or runtime evidence to operational claims whenever possible. If runtime evidence is unavailable, say that the capability is implemented/configured in the repository but runtime health is unverified.

## High-value source paths

- `backend/knowledge/router.py`
- `docs/dkos-ingestion-pipeline.md`
- `docs/HERMES_SELF_UPDATE_RECENCY_LOOP.md`
- `docs/architecture/D3VONN_CAPABILITY_MAP.md`
- `backend/railway_app.py`
- `backend/ai_films/`
- `backend/ai_films/manifests/sovereign_signal_batch_001.json`
- `src/lib/film/canon.ts`
- `backend/ai_films/production_bible.py`
- `docs/film-orchestrator/`
- `docs/runbooks/AI_FILMS_SUPABASE_ROLLOUT.md`
- `src/App.tsx`
- `supabase/migrations/`

## Maintenance rule

Update this file in the same PR whenever a change materially alters product identity, canonical architecture, agent behavior, knowledge ingestion, production boundaries, AI Films canon/manifest, or major provider integrations. After merge/deploy, the Hermes recency process should ingest the new `main` revision and record the resulting DKOS/memory update.
