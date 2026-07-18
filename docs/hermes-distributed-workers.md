# Hermes Distributed Worker Runtime v1

The v1 worker runtime extends the existing Hermes scheduler with a deterministic worker registry and lease model. It does not introduce a second scheduler, queue, or orchestration engine.

## Worker lifecycle

1. A worker registers an identity, region, runtime, version, capabilities, and lease capacity.
2. Heartbeats refresh health and load metadata.
3. Hermes selects an eligible worker by required capability, utilization, region, and worker ID.
4. A task receives one active lease. Repeated acquisition for the same task reuses that lease.
5. Workers renew leases during execution and release them on completion or cancellation.
6. Draining workers accept no new work and become offline after their final lease is released.
7. The registry marks stale workers lost and expires their leases for recovery.

## Invariants

- A task has at most one active lease.
- Lost, offline, or draining workers receive no new leases.
- Selection is deterministic for the same registry state.
- Heartbeat and lease deadlines use the injected Hermes clock.
- Expired leases become eligible for orchestration recovery.
- OCC projections are derived from registry state rather than maintained separately.

## Initial implementation boundary

`InMemoryWorkerRegistry` provides the reference semantics and deterministic test adapter. A persistent adapter can implement the same operations using the existing ports/adapters structure without changing workflow definitions or scheduler policy.
