# Hermes Checkpoint Recovery

Hermes persists durable workflow snapshots in the existing `hermes_checkpoints` table using a versioned JSON envelope stored in the `content` column.

Checkpoint titles use a deterministic format:

`workflow:<execution_id>:checkpoint:<20-digit-sequence>`

Recovery behavior is conservative:

- a running step with no bound task returns to `READY`;
- a running step with a bound task becomes `WAITING` for reconciliation, preventing duplicate dispatch;
- checkpoint checksums, execution IDs, workflow IDs, versions, sequences, and step sets are validated before recovery;
- replay creates a new execution identity and records its source execution and checkpoint sequence.

No parallel workflow table or second orchestration engine is introduced.
