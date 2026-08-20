# PRIMETIME Governed Ingest Security

## Boundary

`POST /api/v1/primetime/ingest` is a pre-inference security boundary. The authenticated principal and workspace membership determine authorization; `organization` in the body is metadata only.

## Required controls

1. Supabase JWT authentication.
2. Explicit workspace context and active membership validation.
3. HMAC-SHA256 request signature over `<unix_timestamp>.<raw_body>`.
4. Five-minute default replay window.
5. Request-size limit (256 KiB default).
6. Pydantic JSON schema with unknown fields rejected.
7. Idempotency key required and bounded.
8. Existing global rate-limit middleware remains in force.
9. Durable database uniqueness must back the idempotency claim before runtime is enabled.
10. Audit event must be persisted before inference/dispatch.

## Runtime safety

The endpoint is intentionally feature-gated by `PRIMETIME_INGEST_ENABLE_RUNTIME`. Until persistence, durable idempotency, Redis locking, audit persistence, and queue dispatch are wired and tested, the endpoint returns `503` rather than falsely claiming a request was durably accepted.

## Signature example

The sender computes:

`HMAC_SHA256(secret, timestamp + "." + raw_request_body)`

and sends:

- `X-PRIMETIME-Timestamp: <unix seconds>`
- `X-PRIMETIME-Signature: sha256=<hex digest>`

Never log the signing secret, Authorization token, or raw signature payload.
