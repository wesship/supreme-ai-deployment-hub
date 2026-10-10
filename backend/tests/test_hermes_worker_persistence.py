from datetime import datetime, timedelta, timezone

import pytest

from backend.hermes.testing import FrozenClock, InMemoryTaskRepository
from backend.hermes.worker_persistence import (
    PersistentWorkerRegistry,
    SupabaseWorkerRegistryStore,
    WorkerVersionConflict,
)
from backend.hermes.workflows.workers import (
    LeaseStatus,
    WorkerCapabilities,
    WorkerRegistryPolicy,
    WorkerStatus,
)


TASK_ID = "00000000-0000-0000-0000-000000000001"


def service():
    clock = FrozenClock(datetime(2026, 7, 18, 12, 0, tzinfo=timezone.utc))
    repository = InMemoryTaskRepository()
    store = SupabaseWorkerRegistryStore(repository)
    persistent = PersistentWorkerRegistry(
        store=store,
        clock=clock,
        policy=WorkerRegistryPolicy(
            heartbeat_timeout=timedelta(seconds=30),
            lease_ttl=timedelta(seconds=20),
        ),
    )
    return persistent, store, repository, clock


async def register_worker(persistent: PersistentWorkerRegistry):
    worker = persistent.registry.register(
        worker_id="worker-a",
        hostname="worker-a.internal",
        region="us-central",
        runtime="docker",
        version="1.0.0",
        capabilities=WorkerCapabilities.from_names(["task-dispatch", "llm"]),
        max_leases=2,
    )
    return worker, await persistent.persist_worker(worker)


@pytest.mark.asyncio
async def test_worker_round_trip_and_restart_restore():
    persistent, _, repository, _ = service()
    worker, _ = await register_worker(persistent)
    await repository.create_row(
        "hermes_worker_leases",
        {
            "lease_id": "lease-existing",
            "task_id": TASK_ID,
            "worker_id": worker.worker_id,
            "capabilities": ["task-dispatch"],
            "acquired_at": "2026-07-18T12:00:00+00:00",
            "renewed_at": "2026-07-18T12:00:00+00:00",
            "expires_at": "2026-07-18T12:05:00+00:00",
            "status": LeaseStatus.ACTIVE.value,
        },
    )

    restored = await persistent.restore()

    assert restored.workers["worker-a"].status == WorkerStatus.HEALTHY
    assert restored.workers["worker-a"].active_leases == 1
    assert restored.task_leases[TASK_ID] == "lease-existing"
    assert restored.leases["lease-existing"].status == LeaseStatus.ACTIVE


@pytest.mark.asyncio
async def test_atomic_claim_uses_one_database_rpc_and_reconciles_local_state():
    persistent, _, repository, clock = service()
    worker, row = await register_worker(persistent)
    repository.tables["hermes_workers"][0].update(
        {"active_leases": 1, "status": "healthy", "version_counter": row["version_counter"] + 1}
    )
    repository.rpc_results["hermes_claim_capability_task"] = [
        {
            "task_id": TASK_ID,
            "lease_id": "lease-db-claim",
            "title": "Atomic claim",
            "description": "claimed in PostgreSQL",
            "task_type": "generic",
            "input_data": {"request": "test"},
            "agent_name": "TARS",
            "correlation_id": None,
            "retry_count": 0,
            "task_status": "LOCKED",
            "lease_status": "active",
            "expires_at": (clock.current + timedelta(seconds=20)).isoformat(),
            "worker_id": worker.worker_id,
            "capabilities": ["task-dispatch"],
            "acquired_at": clock.current.isoformat(),
            "renewed_at": clock.current.isoformat(),
        }
    ]

    claim = await persistent.claim_next_task(
        worker_id=worker.worker_id,
        lease_ttl_seconds=20,
    )

    assert claim is not None
    assert claim.task["id"] == TASK_ID
    assert claim.task["status"] == "LOCKED"
    assert claim.lease.lease_id == "lease-db-claim"
    assert persistent.registry.task_leases[TASK_ID] == "lease-db-claim"
    assert repository.rpc_calls[0] == (
        "hermes_claim_capability_task",
        {
            "p_worker_id": "worker-a",
            "p_lease_ttl_seconds": 20,
        },
    )
    assert not any(table == "hermes_worker_leases" for table in repository.tables)


@pytest.mark.asyncio
async def test_atomic_claim_returns_none_when_database_has_no_eligible_task():
    persistent, _, repository, _ = service()
    worker, _ = await register_worker(persistent)
    repository.rpc_results["hermes_claim_capability_task"] = []

    claim = await persistent.claim_next_task(
        worker_id=worker.worker_id,
        lease_ttl_seconds=300,
    )

    assert claim is None
    assert persistent.registry.task_leases == {}
    assert repository.rpc_calls[-1][0] == "hermes_claim_capability_task"


@pytest.mark.asyncio
async def test_worker_updates_increment_version_and_reject_stale_write():
    persistent, store, _, _ = service()
    worker, _ = await register_worker(persistent)
    assert persistent.worker_versions[worker.worker_id] == 1

    updated = await store.update_worker(
        "worker-a", {"status": WorkerStatus.DRAINING.value}, expected_version=1
    )
    assert updated["version_counter"] == 2

    with pytest.raises(WorkerVersionConflict):
        await store.update_worker(
            "worker-a", {"status": WorkerStatus.OFFLINE.value}, expected_version=1
        )


@pytest.mark.asyncio
async def test_lease_listing_paginates_past_first_thousand_rows():
    _, store, repository, _ = service()
    repository.tables["hermes_worker_leases"] = [
        {
            "id": str(index),
            "lease_id": f"lease-{index}",
            "acquired_at": f"2026-08-08T00:{index // 60:02d}:{index % 60:02d}+00:00",
            "status": LeaseStatus.RELEASED.value,
        }
        for index in range(1001)
    ]

    rows = await store.list_leases(active_only=False)

    assert len(rows) == 1001
    assert {row["lease_id"] for row in rows} == {
        f"lease-{index}" for index in range(1001)
    }


@pytest.mark.asyncio
async def test_atomic_worker_version_predicate_rejects_interleaved_update():
    persistent, store, repository, _ = service()
    _, row = await register_worker(persistent)
    row_id = str(row["id"])

    original_update = repository.update_row_if

    async def interleaved_update(table, current_row_id, payload, conditions):
        await repository.update_row(
            table,
            current_row_id,
            {"status": WorkerStatus.DRAINING.value, "version_counter": 2},
        )
        return await original_update(table, current_row_id, payload, conditions)

    repository.update_row_if = interleaved_update

    with pytest.raises(WorkerVersionConflict):
        await store.update_worker(
            "worker-a",
            {"status": WorkerStatus.OFFLINE.value},
            expected_version=1,
        )

    rows = await repository.list_rows(
        "hermes_workers", {"id": f"eq.{row_id}", "limit": "1"}
    )
    assert rows[0]["version_counter"] == 2
    assert rows[0]["status"] == WorkerStatus.DRAINING.value


def test_store_satisfies_worker_registry_port_shape():
    repository = InMemoryTaskRepository()
    store = SupabaseWorkerRegistryStore(repository)
    assert store.configured is True
