# PRIMETIME Governed Ingest Contract

Status: Contract-first; runtime remains disabled until durable persistence and queue wiring are validated.
Issue: #982

## Endpoint

`POST /api/v1/primetime/ingest`

## Required controls

The request is rejected before inference if any control fails:

- authenticated principal
- authenticated workspace resolution
- request signature verification
- timestamp within configured replay window
- bounded request size
- strict JSON schema
- required idempotency key
- durable workspace-scoped idempotency check
- Redis concurrency lock
- append-only audit/event record

## Authorization

The submitted `organization` field is metadata only. It never determines tenant authorization. Workspace identity comes from the authenticated request context and the canonical PRIMETIME workspace membership boundary.

## Runtime sequence

1. Authenticate.
2. Verify request signature and replay window.
3. Resolve workspace and membership.
4. Validate schema.
5. Acquire Redis fast-path lock.
6. Check/insert durable idempotency record in PostgreSQL.
7. Append the ingest event to the event ledger.
8. Commit the durable acceptance transaction.
9. Enqueue governed work.
10. Run scoring and downstream agents only through explicit capabilities.

Until steps 6–9 are fully wired and tested, `PRIMETIME_INGEST_ENABLE_RUNTIME` must remain disabled and the endpoint must not return `202 Accepted`.

## Response semantics

- `400`: malformed request
- `401`: missing/invalid authentication or signature
- `403`: authenticated principal lacks workspace access
- `409`: idempotency key already claimed with conflicting payload
- `413`: request too large
- `422`: schema validation failure
- `429`: rate limit exceeded
- `202`: accepted and queued, only after durable acceptance and enqueue are verified

## Idempotency

The authenticated workspace plus idempotency key is the uniqueness boundary. Redis provides the short-lived concurrency lock, while the database uniqueness constraint remains the durable duplicate guard.

A duplicate request with the same key and equivalent payload returns the original acceptance identity rather than creating another interaction/dispatch.

## Agent dispatch envelope

Downstream agents receive only:

```json
{
  "dispatch_id": "uuid",
  "lead_id": "uuid",
  "interaction_id": "uuid",
  "scoring": {},
  "authorized_context": {},
  "requested_capabilities": ["research", "draft_outreach", "generate_asset"]
}
```

The raw transcript is not copied into each downstream message. Agents retrieve additional context through an authorization-aware context service.

## Governance

Generated artifacts have independent states:

`ai_generated -> human_approved -> externally_sent`

Rejection and supersession are terminal artifact states. An agent cannot transition an artifact directly to `externally_sent` without the existing approval/compliance path.

## Workflow state machine

The AI workflow state is separate from the CRM pipeline stage:

`RECEIVED -> VALIDATED -> QUEUED -> SCORING -> SCORED -> RESEARCHING -> DRAFTING/ASSET_GENERATION -> AGGREGATING -> READY_FOR_REVIEW -> APPROVED -> READY_FOR_ENGAGEMENT -> ENGAGED -> CONVERTED`

Failures use `FAILED -> RETRYING -> QUEUED` or `FAILED_PERMANENTLY`.

Agents cannot skip states. Human approval is required for `APPROVED` and `READY_FOR_ENGAGEMENT`.
