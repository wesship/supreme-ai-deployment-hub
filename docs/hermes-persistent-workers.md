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
