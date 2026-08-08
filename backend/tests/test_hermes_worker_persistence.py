from datetime import datetime, timedelta, timezone

import pytest

from backend.hermes.adapters import SupabaseTaskRepository
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


def service():
    clock = FrozenClock(datetime(2026, 7, 18, 12, 0, tzinfo=timezone.utc))
    repository = InMemoryTaskRepository()
    store = SupabaseWorkerRegistryStore(repository)  # structural repository compatibility
    persistent = PersistentWorkerRegistry(
        store=store,
        clock=clock,
        policy=WorkerRegistryPolicy(
            heartbeat_timeout=timedelta(seconds=30),
            lease_ttl=timedelta(seconds=20),
        ),
    )
    return persistent, store, repository, clock


@pytest.mark.asyncio
async def test_worker_round_trip_and_restart_restore():
    persistent, _, _, _ = service()
    worker = persistent.registry.register(
        worker_id="worker-a",
        hostname="worker-a.internal",
        region="us-central",
        runtime="docker",
        version="1.0.0",
        capabilities=WorkerCapabilities.from_names(["llm", "browser"]),
        max_leases=2,
    )
    await persistent.persist_worker(worker)
    lease = persistent.registry.acquire_lease(task_id="00000000-0000-0000-0000-000000000001", required_capabilities=["llm"])
    await persistent.persist_lease(lease)
    await persistent.persist_worker(worker)

    restored = await persistent.restore()

    assert restored.workers["worker-a"].status == WorkerStatus.HEALTHY
    assert restored.workers["worker-a"].active_leases == 1
    assert restored.task_leases[lease.task_id] == lease.lease_id
    assert restored.leases[lease.lease_id].status == LeaseStatus.ACTIVE


@pytest.mark.asyncio
async def test_store_reuses_existing_active_task_lease():
    persistent, store, _, _ = service()
    worker = persistent.registry.register(
        worker_id="worker-a",
        hostname="worker-a.internal",
        region="us-central",
        runtime="docker",
        version="1.0.0",
        capabilities=WorkerCapabilities.from_names(["llm"]),
        max_leases=2,
    )
    await persistent.persist_worker(worker)
    lease = persistent.registry.acquire_lease(task_id="00000000-0000-0000-0000-000000000001")
    first = await persistent.persist_lease(lease)
    duplicate = await store.create_lease({**persistent._lease_payload(lease), "lease_id": "other"})

    assert duplicate["id"] == first["id"]
    assert len(await store.list_leases(active_only=True)) == 1


@pytest.mark.asyncio
async def test_worker_updates_increment_version_and_reject_stale_write():
    persistent, store, _, _ = service()
    worker = persistent.registry.register(
        worker_id="worker-a",
        hostname="worker-a.internal",
        region="us-central",
        runtime="docker",
        version="1.0.0",
        capabilities=WorkerCapabilities.from_names(["llm"]),
        max_leases=1,
    )
    row = await persistent.persist_worker(worker)
    assert row["version_counter"] == 1

    updated = await store.update_worker(
        "worker-a", {"status": WorkerStatus.DRAINING.value}, expected_version=1
    )
    assert updated["version_counter"] == 2

    with pytest.raises(WorkerVersionConflict):
        await store.update_worker(
            "worker-a", {"status": WorkerStatus.OFFLINE.value}, expected_version=1
        )


@pytest.mark.asyncio
async def test_restore_expires_stale_worker_lease_and_persists_recovery():
    persistent, store, _, clock = service()
    worker = persistent.registry.register(
        worker_id="worker-a",
        hostname="worker-a.internal",
        region="us-central",
        runtime="docker",
        version="1.0.0",
        capabilities=WorkerCapabilities.from_names(["llm"]),
        max_leases=1,
    )
    await persistent.persist_worker(worker)
    lease = persistent.registry.acquire_lease(task_id="00000000-0000-0000-0000-000000000001")
    await persistent.persist_lease(lease)
    await persistent.persist_worker(worker)

    clock.current += timedelta(seconds=31)
    restored = await persistent.restore()

    assert restored.workers["worker-a"].status == WorkerStatus.LOST
    assert restored.leases[lease.lease_id].status == LeaseStatus.EXPIRED
    persisted = await store.list_leases(active_only=False)
    assert persisted[0]["status"] == LeaseStatus.EXPIRED.value


@pytest.mark.asyncio
async def test_restore_rebuilds_capacity_when_crash_happens_after_lease_persist():
    persistent, _, _, _ = service()
    worker = persistent.registry.register(
        worker_id="worker-a",
        hostname="worker-a.internal",
        region="us-central",
        runtime="docker",
        version="1.0.0",
        capabilities=WorkerCapabilities.from_names(["llm"]),
        max_leases=1,
    )
    await persistent.persist_worker(worker)
    lease = persistent.registry.acquire_lease(
        task_id="00000000-0000-0000-0000-000000000001"
    )
    await persistent.persist_lease(lease)

    restored = await persistent.restore()

    assert restored.workers["worker-a"].active_leases == 1
    assert restored.workers["worker-a"].status == WorkerStatus.BUSY
    assert restored.workers["worker-a"].available_capacity == 0


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
    worker = persistent.registry.register(
        worker_id="worker-a",
        hostname="worker-a.internal",
        region="us-central",
        runtime="docker",
        version="1.0.0",
        capabilities=WorkerCapabilities.from_names(["llm"]),
        max_leases=1,
    )
    row = await persistent.persist_worker(worker)
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
