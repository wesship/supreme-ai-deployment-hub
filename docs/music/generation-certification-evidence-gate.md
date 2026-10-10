# ACE-Step controlled generation evidence gate

This gate defines the evidence contract for the first reviewed ACE-Step 1.5 generation certification run. It does not start a model, download weights, provision GPU compute, enable a provider, or approve production use.

## Preconditions

Run generation only after the private GPU runner preflight and private GPU evidence workflow have passed on an approved NVIDIA host. Use the pinned ACE-Step source/model revisions, reviewed model artifact manifest, digest-pinned runtime image, and reviewed exact-runtime CycloneDX SBOM.

## Required run

The controlled qualification run must produce at least 25 successful generations and record failures as part of the denominator. Use fixed test prompts/seeds defined by the qualification operator, including at least one deterministic repeat and one lyrics-capable case. Keep generated artifacts private.

The resulting evidence JSON must include:

- pinned source/model revisions;
- reviewed weights-manifest and runtime-image SHA-256 digests;
- GPU model, driver, CUDA, and PyTorch versions;
- successful generation count and error rate;
- p50/p95 generation latency and peak VRAM;
- deterministic seed-match result;
- audio-QA pass result and report digest;
- provenance-manifest digest;
- `review_status: PENDING_REVIEW`.

Validate it with:

```bash
node scripts/validate-music-generation-evidence.mjs /secure/evidence/ace-step-generation-evidence.json
```

The validator enforces the current certification thresholds: at least 25 successful generations, error rate no greater than 0.02, p95 no greater than 120 seconds, deterministic seed match, passing audio QA, immutable digests, and exact pinned provider revisions.

## Human-review boundary

A validator PASS means only that the evidence is structurally complete and meets the numeric contract. It does not certify licensing, output quality, commercial rights, provenance accuracy, or production safety. The evidence remains `PENDING_REVIEW` until a human reviewer inspects the underlying artifacts and records approval through the separate certification process.

## Activation invariant

ACE-Step must remain disabled while this gate is pending. Do not set `production_enabled`, provider `enabled`, hosted/commercial flags, or reviewer approval from the evidence producer or validator. Production activation is a later explicit change after all qualification evidence is reviewed.
