# Hermes v1 Cancellation and Timeout Enforcement

## Objective

Add restart-safe cancellation propagation and deterministic deadline enforcement to the existing Hermes workflow coordinator without introducing a second execution engine, queue, or scheduler database.

## Immediate implementation scope

1. Add optional workflow and step timeout contracts while preserving schema compatibility.
2. Introduce explicit cancellation metadata: requester, reason, requested timestamp, and terminal timestamp.
3. Add a cancellation service that transitions the workflow to `CANCELLED`, cancels all non-terminal steps, and updates bound Hermes tasks idempotently.
4. Propagate cancellation to downstream dependents and prevent the parallel scheduler from dispatching cancelled or expired work.
5. Add deadline evaluation using the injected clock so timeout behavior remains deterministic and testable.
6. Route retryable step timeouts through the existing retry policy; terminal timeouts become structured failures.
7. Persist a checkpoint for every cancellation, timeout, retry, and terminal transition.
8. Emit lifecycle events for cancellation requested, step cancelled, workflow cancelled, step timed out, workflow timed out, and timeout retry scheduled.
9. Add OCC projections for cancellation state, deadline state, timed-out tasks, and remaining runtime.
10. Add focused regression tests for idempotency, restart recovery, partial parallel batches, downstream propagation, retry interaction, and late task completion after cancellation.

## Invariants

- Completed steps remain completed.
- Cancellation is idempotent.
- A cancelled or timed-out step can never be redispatched unless the existing retry service explicitly schedules a retry.
- Late agent completions cannot revive cancelled workflows.
- Persisted checkpoints remain the source of truth after restart.
- Existing workflows without timeout configuration retain current behavior.
