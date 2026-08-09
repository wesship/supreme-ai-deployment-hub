# Hermes Persistent Worker State

This phase persists the distributed worker registry and task leases without changing the scheduler or workflow definition model.

## Storage

- `hermes_workers` stores worker identity, capabilities, capacity, health, heartbeat time, metadata, and an optimistic version counter.
- `hermes_worker_leases` stores task-to-worker assignments and lease deadlines.
- A partial unique index guarantees at most one active lease per task at the database boundary.
- Row-level security is enabled and no browser-facing policies are added; the backend service role remains the control plane.

## Restart recovery

`PersistentWorkerRegistry.restore()` reconstructs the in-memory scheduling view from durable rows, sweeps stale workers and expired leases using the injected Hermes clock, then persists the resulting lost/expired states. This keeps scheduling deterministic while allowing the production process to restart safely.

## Concurrency

Worker updates increment `version_counter`. Callers may provide `expected_version` to reject stale writes. Active task lease uniqueness is also enforced in PostgreSQL, which remains authoritative under concurrent schedulers.

## Deployment

Apply `supabase/migrations/20260718_hermes_workers.sql` before enabling persistent worker mode. The in-memory registry remains available for tests and local development.

## Rollback

1. Disable persistent worker mode and drain workers.
2. Confirm no active rows remain in `hermes_worker_leases`.
3. Archive the two tables if operational history must be retained.
4. Drop `hermes_worker_leases` before `hermes_workers` because of the foreign key.

Rollback does not affect workflow checkpoints or `hermes_tasks`; unleased tasks remain recoverable by the existing Hermes runtime.


## Runtime activation

The polling worker can opt into durable worker state with
`HERMES_PERSISTENT_WORKERS_ENABLED=true`. The flag defaults to `false`.
When enabled, startup fails closed unless Supabase service-role access is
configured. The worker restores durable state, registers or rejoins its stable
worker identity, heartbeats each polling tick, leases tasks before claiming
them, and drains on graceful shutdown.

Configuration:

- `HERMES_WORKER_ID`: stable identity; defaults to the container hostname.
- `HERMES_WORKER_REGION`: deployment region; defaults to `unknown`.
- `HERMES_WORKER_CAPABILITIES`: comma-separated capabilities; defaults to
  `task-dispatch`.
- `HERMES_WORKER_HEARTBEAT_TIMEOUT_SECONDS`: stale-worker threshold; defaults
  to 90 seconds.
- `HERMES_WORKER_LEASE_TTL_SECONDS`: task lease lifetime; defaults to 300
  seconds.

Atomic `PENDING → LOCKED` compare-and-set remains the authoritative task claim.
Dispatch uses the stable key `hermes-task:<task-id>`, providing effectively-once
restart behavior when the downstream dispatcher honors idempotency. A strict
cross-system exactly-once guarantee would require a transactional outbox.

## Staging canary

1. Keep production at `HERMES_PERSISTENT_WORKERS_ENABLED=false`.
2. Enable the flag for one staging Hermes replica with a stable
   `HERMES_WORKER_ID`.
3. Submit a disposable task and confirm one active lease and one dispatch.
4. Terminate the worker after lease acquisition, restart it, and confirm the
   same lease ID is restored.
5. Confirm the task reaches a terminal state, the lease becomes released, and
   only one downstream execution exists for `hermes-task:<task-id>`.
6. Repeat with termination after the task reaches `RUNNING`.
7. Promote only after both cases pass and monitoring shows no duplicate
   dispatches or orphaned active leases.
