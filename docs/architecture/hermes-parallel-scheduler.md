# Hermes Parallel Scheduler

The scheduler is a planning layer over the existing restart-safe workflow coordinator.
It does not create a second execution engine, queue, or persistence model.

## Responsibilities

- Discover currently ready workflow steps.
- Count active Hermes tasks from persisted task state.
- Apply global, workflow, and per-agent concurrency limits.
- Select fair deterministic batches across agents.
- Delegate selected steps to `WorkflowExecutionCoordinator`.
- Emit capacity, saturation, and dispatch lifecycle events.
- Provide OCC-ready queue and utilization projections.

## Technical-debt boundary

Task binding, checkpointing, idempotency, and external dispatch remain owned by the
existing coordinator. The scheduler only chooses which ready steps may proceed.
This keeps scheduling policy independently replaceable without duplicating runtime
state transitions or delivery guarantees.
