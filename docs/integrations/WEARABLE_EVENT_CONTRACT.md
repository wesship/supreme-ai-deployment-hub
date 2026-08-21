# Wearable Event Contract

Canonical envelope for `vision.d3vonn.io` and wearable integrations.

```json
{
  "event_id": "uuid",
  "event_type": "vision.entity.detected",
  "occurred_at": "2026-08-21T00:00:00Z",
  "source": {
    "adapter": "meta-dat",
    "device_id": "device-id",
    "session_id": "session-id"
  },
  "correlation_id": "run-id",
  "privacy": {
    "classification": "user_private",
    "consent": true
  },
  "payload": {},
  "capabilities": ["camera", "audio"],
  "audit": {
    "policy_version": "wearable-v1",
    "trace_id": "trace-id"
  }
}
```

## Invariants

- `event_id` is globally unique and idempotent.
- `occurred_at` is device-observed time when available.
- `correlation_id` connects perception to agent/action runs.
- Privacy/consent metadata is mandatory for captured media.
- Raw media should not be persisted by default; store references or derived structured data unless policy explicitly permits retention.
- Every action emitted from a wearable event must be auditable.

## HTTP endpoints

`POST /api/v1/vision/events` accepts canonical events.

Recommended response:

```json
{
  "accepted": true,
  "event_id": "uuid",
  "correlation_id": "run-id",
  "next": "queued"
}
```

Clients should retry safely using the same `event_id`.
