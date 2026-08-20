# PRIMETIME Governed Intelligence Increment

Status: Engineering increment / pre-production
Issue: #982

## Canonical integration decision

This increment extends the existing PRIMETIME CRM foundation. It does not introduce a parallel lead model. `public.primetime_leads` remains the authoritative lead record, with interactions, dispatches, agent runs, artifacts, and embeddings linked to it.

The existing governed runtime reconciliation remains authoritative for renamed columns (`owner_id`, `actor_id`, `action`, `metadata`) and existing workspace membership enforcement. Historical migrations remain immutable.

## Security boundary

The authenticated workspace is authoritative. Any submitted organization/workspace identifier is metadata only and must never select a tenant or bypass authorization.

Ingestion must complete, in order, before model execution:

1. Authentication
2. Signature verification
3. Timestamp/replay-window validation
4. Request-size/rate controls
5. JSON schema validation
6. Authenticated workspace resolution
7. Idempotency claim / Redis lock
8. Audit event
9. Persistence
10. Scoring/dispatch

## Governed lifecycle

```text
RECEIVED
  -> VALIDATED
  -> QUEUED
  -> SCORING
  -> SCORED
  -> RESEARCHING
  -> DRAFTING
  -> ASSET_GENERATION
  -> AGGREGATING
  -> READY_FOR_REVIEW
  -> APPROVED
  -> READY_FOR_ENGAGEMENT
  -> ENGAGED
  -> CONVERTED
```

Failure states are explicit: `FAILED -> RETRYING -> FAILED_PERMANENTLY`.

Only the governed state-transition service may advance workflow state. Agents cannot directly set consequential states.

## Least-privilege dispatch

Downstream agents receive a dispatch envelope containing:

- `dispatch_id`
- `lead_id`
- `interaction_id`
- structured scoring
- authorized context
- requested capabilities

Raw transcripts are retrieved only through an authorization-aware context service. They are not copied into every downstream dispatch payload.

## Vector policy

The repository already relocates pgvector into the `extensions` schema. This increment stores embeddings using the existing extension type but deliberately does not create a fixed-dimension ANN index until the actual embedding provider/model and dimension are confirmed.

Each embedding records its model and dimension so mixed-model history cannot be mistaken for a homogeneous index.

## Communication governance

`AI generated`, `human approved`, and `externally sent` are separate artifact states. An AI-generated artifact is never considered outbound merely because generation succeeded.

No outbound communication may execute without the existing consent/suppression/compliance boundary.

## Production gate

This branch must not execute its SQL against production. Before deployment, the PR must establish:

- exact target database schema compatibility
- confirmed embedding model and dimension
- RLS tenant-isolation tests
- replay/idempotency tests
- state-machine transition tests
- ingestion signature tests
- agent capability enforcement tests
- existing PRIMETIME staging gate compatibility
- existing D3VONN production gates
- rollback procedure
