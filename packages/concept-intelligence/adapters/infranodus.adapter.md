# InfraNodus Adapter Contract

## Purpose

Use InfraNodus as an external structural-analysis specialist for text networks, topic clusters, structural gaps, and bridge questions. PRIMETIME remains the canonical authority.

## Input contract

The adapter accepts only approved source packages containing:

- `workspaceId`
- `sourceId`
- source title and type
- normalized UTF-8 text
- source locator
- retrieval timestamp
- content hash
- permitted analysis modes
- data-classification label

Sensitive personal, health, financial-account, underwriting, or restricted client data must be removed or explicitly approved before transfer.

## Requested analysis modes

- key concepts
- topic clusters
- centrality
- disconnected components
- structural gaps
- bridge concepts
- bridge questions
- source excerpts supporting returned concepts

## Output contract

Every returned item must include:

- external analysis identifier
- concept or relationship label
- cluster identifier where available
- score or rank
- source identifier
- source excerpt or locator when available
- adapter timestamp
- provider version
- raw provider payload hash

## Promotion rules

InfraNodus output enters PRIMETIME as `DISCOVERED` or `EXTRACTED` only. It cannot directly create `CANONICAL` concepts or relationships.

Required processing:

```text
InfraNodus result
  -> schema validation
  -> concept normalization
  -> duplicate detection
  -> source and excerpt validation
  -> confidence calculation
  -> human review
  -> optional compliance or licensed review
  -> canonical promotion
```

## Failure handling

- Retry transient errors with bounded exponential backoff.
- Use an idempotency key per source-analysis request.
- Preserve the source content hash and provider response hash.
- Never silently substitute AI-generated evidence.
- Quarantine malformed or source-less results.
- Record provider latency, cost, and error class.

## Vendor boundary

Neo4j and PRIMETIME governance own the approved graph. InfraNodus is replaceable and must not be the only location holding concepts, relationships, or source provenance.
