# Hermes Distributed Task Dispatch

This stacked phase builds on persistent worker state from PR #443. It remains a draft until GitHub-hosted runners are restored and the dependency PR is validated.

## Delivery flow

1. Hermes acquires an active worker lease from the existing worker registry.
2. The dispatcher creates a versioned `hermes.worker-task.v1` envelope.
3. The envelope carries stable delivery, task, lease, worker, and idempotency identities.
4. The transport publishes the envelope once per delivery ID.
5. The worker acknowledges using the matching worker and lease identity.
6. Completion or failure releases the lease.
7. An unacknowledged delivery expires and becomes eligible for safe redelivery with a new attempt identity.

## Invariants

- A task has at most one active delivery record in the dispatcher.
- An acknowledgement is accepted only from the worker holding the active task lease.
- Completion is idempotent.
- Transport publication is idempotent by delivery ID.
- Acknowledgement timeout never exceeds the worker lease deadline.
- Expired unacknowledged deliveries cancel their leases before redelivery.
- The dispatcher reuses the existing worker registry and does not introduce another queue or scheduler.

## Transport boundary

`WorkerTransport` is intentionally minimal. Production adapters may use authenticated HTTP pull/push, Redis streams, NATS, or another approved transport without changing workflow or scheduler contracts. The in-memory adapter defines deterministic behavior for tests.

## Stacked delivery status

This branch is based on `feat/hermes-v1-persistent-workers` and must not merge before PR #443. Once GitHub Actions runner provisioning is restored:

1. Validate and merge PR #443.
2. Retarget this PR to `main`.
3. Run the complete backend, contract, security, coverage, and deployment gates.
4. Merge only after all required checks pass.
