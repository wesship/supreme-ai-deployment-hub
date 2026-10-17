# D3VONN.IO The Door — World Synthesis Contract

Status: SCAFFOLDED / NOT RUNTIME-CERTIFIED

## Purpose

World Synthesis extends World Forge with a deterministic, offline-first contract for participatory worlds. Unreal Engine remains authoritative for gameplay, saves, combat, traversal, NPC state, and packaged offline operation. D3VONN.IO/Hermes and cloud models are optional proposal providers; they never directly mutate authoritative gameplay state.

## Core records

### WorldStateSnapshot
A versioned, immutable input snapshot containing world/realm ID, location ID, player-safe world state, faction/event state, NPC references, simulation clock, content revision, and deterministic seed.

### NPCMemory
A bounded gameplay-owned memory record containing NPC ID, event fingerprint, salience, game-time timestamp, provenance, retention policy, and safe summary. Raw model transcripts are not authoritative memory.

### WorldEvent
A deterministic event envelope containing event ID, type, affected entities, preconditions, proposed effects, source/provenance, seed, and validation status.

### SynthesisRequest
Contains request ID, snapshot digest, requested capability, deterministic seed, latency budget, cost budget, provider policy, offline fallback ID, and schema version.

### SynthesisProposal
Provider output is proposal-only. It contains request ID, proposed content/events/dialogue, provenance, model/provider revision, generation parameters, content digest, latency/cost observations, and validation result.

## Authority boundary

1. UE5 captures a WorldStateSnapshot.
2. World Forge builds a SynthesisRequest.
3. The request may resolve locally, use authored content, or be sent through the authenticated D3VONN gateway to Hermes.
4. Any generated response returns as a SynthesisProposal.
5. UE5 validates schema, provenance, budgets, allowed effects, deterministic constraints, and current-state preconditions.
6. Only validated effects are converted into normal UE gameplay commands/events.
7. Saves persist the accepted gameplay result and provenance—not a dependency on the external model.

Cloud output MUST NOT directly write save data, execute arbitrary gameplay code, change security/auth state, or become authoritative world state.

## Offline-first behavior

Every synthesis capability must have an authored or deterministic local fallback. A network failure, provider outage, timeout, budget exhaustion, invalid response, or disabled D3VONN integration must preserve a playable packaged game.

## Determinism and replay

Each request carries a stable seed and snapshot digest. Accepted proposals record their content digest and provider provenance. Replay/debug tooling must be able to substitute the recorded accepted result without contacting a cloud provider.

## Budgets

Each request declares hard latency and cost ceilings. Exceeding either ceiling fails closed to fallback content. NPC memory and world-event growth are bounded by explicit retention/compaction rules.

## Spatial-content pipeline

Real-world capture may enter World Forge through photogrammetry, point clouds, or 3D Gaussian splats. Runtime-ready assets may be converted/optimized into UE-supported geometry, Nanite-compatible meshes, textures/materials, collision, HLOD/World Partition content, or another certified representation. A splat is source/spatial evidence, not automatically authoritative gameplay geometry.

## Initial synthesis capabilities

- contextual NPC dialogue proposals
- bounded NPC memory summaries
- quest/event proposals
- environmental dressing proposals
- faction/world reaction proposals

Combat resolution, inventory ownership, player progression, save integrity, authentication, purchases, and security-sensitive actions remain deterministic/authoritative and outside direct generative control.

## Certification gates

This contract does not enable cloud-generated gameplay. Certification requires, in order:

1. Gate 107 UE5.3 UHT/C++/link success on the real Windows runner.
2. World Forge automation/runtime evidence.
3. Save/reload and packaged offline smoke.
4. Deterministic synthesis contract tests using local fixtures only.
5. Authenticated D3VONN gateway canary with strict timeout/budget/fallback behavior.
6. Human review of generated-content policy and telemetry/provenance evidence.

Until those gates pass, World Synthesis remains SCAFFOLDED and cloud synthesis remains disabled.
