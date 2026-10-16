# Music Hub Gate 11 — private storage schema / integration boundary

This is a **migration proposal**, not a deployed service. It adds owner-scoped Postgres job/artifact records and a private Supabase Storage bucket with read-only owner policies. No frontend uploads or production dispatch are enabled.

Outstanding release-critical work:
- Run a staging migration replay against a real Supabase database; inspect grants, policy interactions, bucket settings, and cross-account negative tests.
- Implement a server-side authenticated upload initiation flow; validate bearer token, derive owner from the verified session, validate file hash/content/format/size, and generate short-lived upload permission scoped to the exact owner prefix.
- Implement an atomic idempotent job enqueue + outbox in Postgres and a durable Hermes dispatcher. The SQLite Gate 10 prototype must not be used in production.
- Verify model qualification on the server (no boolean approval from clients), enforce per-user quotas, then dispatch to a private GPU worker.
- Implement lease/heartbeat/retry/dead-letter semantics; guard cancellation races and verify output hashes.
- Retrieve stems through short-lived signed download URLs after authenticated ownership checks.
- Review worker permissions, artifact user/job relationships, retention cleanup and audio confidentiality.
- Run unit, SQL integration, E2E, security, and audio quality testing; obtain deployment approval.

Release HOLD. The schema is not proof that upload, API, queue, or inference paths function.
