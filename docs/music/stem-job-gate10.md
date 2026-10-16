# Gate 10: durable stem job orchestration — internal staging only

This gate introduces `StemJobLedger` as an internal, durable SQLite state ledger with idempotent submissions, owner-scoped lookups, terminal cancellation, and explicit worker-only transitions.

**Non-production boundary:** There are no public endpoints, upload handlers, artifact URLs, Hermes queue bindings, or worker activation in this change. An explicit `qualified=True` argument is **only a testable internal policy seam**, not authenticated proof of approval. Likewise `worker_authorized=True` is not an authentication mechanism. Do not expose these methods directly to an HTTP request.

Before using this component in production:
1. Replace the SQLite prototype with the existing production Postgres queue/storage pattern; perform concurrent transaction and replay tests.
2. Implement service-verified identity; derive owner from a validated session, never request body.
3. Verify private upload owner, checksum, media format, size, and authorized model policy on the server.
4. Integrate Hermes outbox/queue transaction with explicit worker identity, retries, lease expiration, cancellation, and crash recovery.
5. Require owner-scoped artifact access with private signed URLs, checksums, TTL cleanup, and malware/media validation.
6. Constrain task quota, cost, and upload rate. Audit cross-account access and unauthorized worker transitions.
7. Qualify pinned Demucs/Audio Separator executable and weights under real GPU tests, review licenses, and obtain operator approval.
8. Run CI and browser/audio QA before enabling the flags or merging.

No production deployment or model execution is authorized by this change. Release remains HOLD.
