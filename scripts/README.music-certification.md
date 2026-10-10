# Music production certification validator

`scripts/validate-ace-step-production-certification.mjs` is a fail-closed contract for ACE-Step 1.5 production evidence.

Accepted certification statuses are exactly `PENDING_EXTERNAL_EVIDENCE`, `PASS`, and `FAIL`. A `PASS` requires complete evidence, valid SHA-256 report/manifests, at least the configured successful-generation count, acceptable error rate and p95 latency, deterministic output confirmation, audio-QA confirmation, positive VRAM evidence, and reviewer metadata.

The certification record never enables production itself. `production_enabled` must remain false; activation is a separate reviewed registry change.
