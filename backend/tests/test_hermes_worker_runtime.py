"""Activation and crash-recovery tests for the persistent Hermes worker runtime."""

from __future__ import annotations

from datetime import datetime, timedelta, timezone

import pytest

from backend.hermes.testing import FrozenClock, InMemoryTaskRepository
from backend.hermes.worker_persistence import (
    PersistentWorkerRegistry,
    SupabaseWorkerRegistryStore,
    WorkerVersionConflict,
)
from backend.hermes.worker_runtime import (
    PersistentWorkerRuntime,
    PersistentWorkerRuntimeConfig,
)
from backend.hermes.workflows.workers import LeaseStatus, WorkerRegistryPolicy, WorkerStatus


def runtime_service(
    repository: InMemoryTaskRepository,
    clock: FrozenClock,
    *,
    enabled: bool = True,
) -> PersistentWorkerRuntime:
    policy = WorkerRegistryPolicy(
        heartbeat_timeout=timedelta(seconds=30),
        lease_ttl=timedelta(seconds=60),
    )
    persistence = PersistentWorkerRegistry(
        store=SupabaseWorkerRegistryStore(repository),
        clock=clock,
        policy=policy,
    )
    return PersistentWorkerRuntime(
        persistence=persistence,
        config=PersistentWorkerRuntimeConfig(
            enabled=enabled,
            worker_id="worker-a",
            hostname="worker-a.internal",
            region="us-central",
            capabilities=("task-dispatch",),
            max_leases=2,
            heartbeat_timeout_seconds=30,
            lease_ttl_seconds=60,
        ),
        clock=clock,
    )


@pytest.mark.asyncio
async def test_default_off_runtime_does_not_touch_persistence():
    repository = InMemoryTaskRepository()
    clock = FrozenClock(datetime(2026, 8, 9, tzinfo=timezone.utc))
    runtime = runtime_service(repository, clock, enabled=False)

    assert await runtime.start() is None
    assert runtime.started is False
    assert repository.tables == {}


@pytest.mark.asyncio
async def test_enabled_runtime_registers_heartbeats_and_drains_worker():
    repository = InMemoryTaskRepository()
    clock = FrozenClock(datetime(2026, 8, 9, tzinfo=timezone.utc))
    runtime = runtime_service(repository, clock)

    worker = await runtime.start()
    assert worker is not None
    assert worker.worker_id == "worker-a"
    assert worker.status is WorkerStatus.HEALTHY

    clock.current += timedelta(seconds=5)
    heartbeat = await runtime.heartbeat()
    assert heartbeat is not None
    assert heartbeat.last_heartbeat_at == clock.current

    stopped = await runtime.stop()
    assert stopped is not None
    assert stopped.status is WorkerStatus.OFFLINE


@pytest.mark.asyncio
async def test_restart_recovers_same_active_lease_without_duplicate():
    repository = InMemoryTaskRepository()
    clock = FrozenClock(datetime(2026, 8, 9, tzinfo=timezone.utc))
    first = runtime_service(repository, clock)
    await first.start()
    lease = await first.acquire("00000000-0000-0000-0000-000000000001")

    assert lease is not None
    assert lease.worker_id == "worker-a"

    restarted = runtime_service(repository, clock)
    await restarted.start()
    recovered = restarted.recoverable_leases()

    assert [item.lease_id for item in recovered] == [lease.lease_id]
    same = await restarted.acquire(lease.task_id)
    assert same is not None
    assert same.lease_id == lease.lease_id
    active_rows = [
        row
        for row in repository.tables["hermes_worker_leases"]
        if row["status"] == LeaseStatus.ACTIVE.value
    ]
    assert len(active_rows) == 1

    released = await restarted.release(lease.lease_id)
    assert released.status is LeaseStatus.RELEASED
    assert restarted.recoverable_leases() == ()


@pytest.mark.asyncio
async def test_restart_expires_stale_lease_before_worker_rejoins():
    repository = InMemoryTaskRepository()
    clock = FrozenClock(datetime(2026, 8, 9, tzinfo=timezone.utc))
    first = runtime_service(repository, clock)
    await first.start()
    lease = await first.acquire("00000000-0000-0000-0000-000000000002")
    assert lease is not None

    clock.current += timedelta(seconds=61)
    restarted = runtime_service(repository, clock)
    worker = await restarted.start()

    assert worker is not None
    assert worker.status is WorkerStatus.HEALTHY
    assert restarted.recoverable_leases() == ()
    lease_rows = repository.tables["hermes_worker_leases"]
    assert lease_rows[0]["status"] == LeaseStatus.EXPIRED.value


@pytest.mark.asyncio
async def test_duplicate_worker_identity_rejects_stale_heartbeat():
    repository = InMemoryTaskRepository()
    clock = FrozenClock(datetime(2026, 8, 9, tzinfo=timezone.utc))
    first = runtime_service(repository, clock)
    second = runtime_service(repository, clock)
    await first.start()
    await second.start()

    clock.current += timedelta(seconds=1)
    with pytest.raises(WorkerVersionConflict):
        await first.heartbeat()
