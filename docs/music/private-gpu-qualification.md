# Music Hub private GPU qualification

This gate qualifies a provider for D3VONN Music Hub without exposing a public model endpoint or enabling production dispatch prematurely.

## Pinned identities

- ACE-Step 1.5 source: `ca1e85fe9430179831e6bc6be790c332190a3866`
- ACE-Step 1.5 model: `19671f406d603126926c1b7e2adc169acbcade22`
- ACE-Step XL Turbo model: `200ba991ae448051e14b0183157e35c2d27c9fb0`
- HeartMuLa source: `3783bdb8441f2c298b1e64c8651173aac200361c`
- HeartMuLa OSS 3B model: `d12ac79c6b3387d5c9eee456323495d8f08bb09d`

## Artifact verification

Download only the pinned revisions on the intended GPU host. Record SHA-256 for every weight/checkpoint artifact and derive an aggregate manifest digest. The aggregate digest is copied into `weights_sha256` only after the manifest has been reviewed. Never hash an unpinned `main` checkout.

## Network boundary

The model server must be private. Only the D3VONN backend/provider gateway may call it. Do not expose ACE-Step or HeartMuLa directly to the browser. Provider credentials and endpoint URLs remain server-side.

## Smoke-test contract

For each provider:

1. Start the pinned model on the selected GPU.
2. Confirm health/readiness.
3. Generate a deterministic 20-30 second instrumental test with a fixed seed.
4. Generate one lyrics test where supported.
5. Reject empty, corrupt, excessively silent, or non-audio output.
6. Pass the output through `/api/music/audio-qa` and mastering.
7. Store only the mastered artifact in the private music library.
8. Persist generation metadata, model/source revisions, weight hash, seed, prompt hash, QA result, and policy snapshot.
9. Record latency, peak VRAM, output duration, and failure reason when applicable.

## Suggested qualification hardware

- ACE-Step 1.5 default: NVIDIA GPU with at least 8 GB VRAM for a comfortable first qualification target; lower-memory modes remain possible but are not the baseline production target.
- ACE-Step XL Turbo: at least 12 GB VRAM with offload; 20 GB or more preferred.
- HeartMuLa OSS 3B: benchmark on a CUDA GPU before setting a production VRAM target; its model repository is substantially larger than the default ACE-Step package.

## Activation rule

A provider stays blocked until all qualification fields are complete, the audio-QA result passes, a reviewer records approval, and the registry is explicitly changed to enable hosting/commercial dispatch. CI rejects an enabled provider whose qualification record remains incomplete.

## Paid-compute boundary

GPU smoke tests must run on an already-approved private GPU or an explicitly authorized paid compute target. Repository changes alone never imply approval to incur cloud GPU charges.
