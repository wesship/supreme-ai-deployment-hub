# Music Hub provider qualification status

## Gate status

Control-plane implementation is complete. Immutable provider identities are pinned and the pull request is mergeable. Production activation remains blocked pending artifact hashes, final dependency-license review, paid/private GPU smoke tests, audio QA, and reviewer approval.

## ACE-Step 1.5 — default

- Source revision: `ca1e85fe9430179831e6bc6be790c332190a3866`
- Model revision: `19671f406d603126926c1b7e2adc169acbcade22`
- License: MIT
- Artifact hash: pending production download
- GPU smoke test: pending approved GPU compute
- Audio QA: pending GPU output
- Activation: blocked

## ACE-Step 1.5 XL Turbo — premium

- Source revision: `ca1e85fe9430179831e6bc6be790c332190a3866`
- Model revision: `200ba991ae448051e14b0183157e35c2d27c9fb0`
- License: MIT
- Minimum qualification VRAM target: 12 GB
- Preferred qualification VRAM target: 20+ GB
- Artifact hash: pending production download
- GPU smoke test: pending approved GPU compute
- Audio QA: pending GPU output
- Activation: blocked

## HeartMuLa OSS 3B — secondary

- Source revision: `3783bdb8441f2c298b1e64c8651173aac200361c`
- Model revision: `d12ac79c6b3387d5c9eee456323495d8f08bb09d`
- License: Apache-2.0
- Artifact hash: pending production download
- GPU smoke test: pending approved GPU compute
- Audio QA: pending GPU output
- Activation: blocked

## Remaining exit sequence

1. Download each pinned model revision on the selected private GPU target.
2. Generate and review the weight/checkpoint SHA-256 manifest.
3. Complete dependency-license inventory against the final runtime image/SBOM.
4. Execute deterministic instrumental and lyrics smoke tests.
5. Pass outputs through Music Hub audio QA/mastering.
6. Record latency, VRAM, duration, and QA evidence.
7. Record reviewer and approval timestamp.
8. Explicitly enable only the provider that passed qualification.
9. Keep auto-routing disabled until at least two providers have independently passed qualification.
