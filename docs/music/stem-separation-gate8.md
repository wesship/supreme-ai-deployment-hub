# Music Hub Gate 8 — Stem Separation Adapter (HOLD)

## Implemented
- Typed job lifecycle contract and artifact manifest for Demucs/Audio Separator candidates.
- Fail-closed adapter: no endpoint, credentials, implicit upload, polling, or worker deployment.
- Qualification predicate requires immutable revisions, checkpoint checksum, approved licenses, audio QA, operator approval, and explicit enablement.
- Tests for qualification rejection, job validation, and fail-closed calls.

## Required backend implementation before connecting the Music Hub UI
1. Authenticated upload initiation with ownership, content hash, content-type and size validation; store uploads privately with TTL.
2. Hermes-governed idempotent enqueue with user-bound quota and concurrency limits; persist queued/running/succeeded/failed/cancelled transitions.
3. Private GPU worker that pins code and checkpoint hashes, runs model preflight, never accepts arbitrary user-supplied model URLs, and times out safely.
4. Output verification (PCM, duration, channels, sample rate, peak, artifacts hash), malware/format scanning, and a private storage manifest.
5. Authenticated ownership-checked job status/cancel and short-lived artifact access; delete temporary data on schedule.
6. Test failure paths, retries, cancellation, cross-account isolation, logging with no sensitive audio URLs, and observed cost per minute.
7. Supply real reviewed adapter to StemSeparationGateway only after operator approval.

## Not yet done
- No separation worker, upload API, or real job wiring exists in this gate.
- No model weights downloaded or enabled.
- No browser/GPU audio QA or production verification claimed.

Release remains HOLD. The draft PR must not merge/publish until all gates pass.
