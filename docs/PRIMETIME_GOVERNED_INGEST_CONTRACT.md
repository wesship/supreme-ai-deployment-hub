# PRIMETIME Governed Ingest Contract

Status: Contract-first; implementation follows after reconciliation
Issue: #982

## Endpoint

`POST /api/v1/primetime/ingest`

## Required controls

The request is rejected before inference if any control fails:

- authenticated principal
- authenticated workspace resolution
- request signature verification
- timestamp within configured replay window
- unique idempotency key
- request body size limit
- rate limit
- JSON schema validation
- audit event creation

The request body must not be able to select or override the authenticated workspace.

## Request envelope

```json
{
  "idempotency_key": "client-generated-unique-key",
  "event_type": "interaction.received",
  "occurred_at": "2026-08-20T19:25:00Z",
  "organization": "submitted-as-metadata-only",
  "lead": {
    "external_id": "optional-source-id",
    "first_name": "Jane",
    "last_name": "Doe",
    "email": "jane@example.com",
    "phone": "+1..."
  },
  "interaction": {
    "type": "message",
    "channel": "email",
    "content": "...",
    "metadata": {}
  }
}
```

## Response semantics

- `400`: malformed request
- `401`: missing/invalid authentication or signature
- `403`: authenticated principal lacks workspace access
- `409`: idempotency key already claimed with conflicting payload
- `413`: request too large
- `422`: schema validation failure
- `429`: rate limit exceeded
- `202`: accepted and queued

## Idempotency

The authenticated workspace plus idempotency key is the uniqueness boundary. Redis may provide the short-lived processing lock, but the database uniqueness constraint remains the durable duplicate guard.

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
