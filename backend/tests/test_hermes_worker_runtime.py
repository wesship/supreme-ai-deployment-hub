"""Activation and restart-recovery tests for the persistent Hermes worker runtime."""
from __future__ import annotations

from datetime import datetime, timedelta, timezone

import pytest

from backend.hermes.testing import FrozenClock, InMemoryTaskRepository
from backend.hermes.worker_persistence import (
    PersistentWorkerRegistry,
    SupabaseWorkerRegistryStore,
)
from backend.hermes.worker_runtime import (
    PersistentWorkerRuntime,
    PersistentWorkerRuntimeConfig,
    _normalize_capabilities,
)
from backend.hermes.workflows.workers import LeaseStatus, WorkerRegistryPolicy, WorkerStatus


TASK_ID = "00000000-0000-0000-0000-000000000001"


def test_worker_capabilities_are_normalized_and_keep_dispatch_base():
    assert _normalize_capabilities(
        (" Visual-QA ", "browser-control", "visual-qa")
    ) == ("browser-control", "task-dispatch", "visual-qa")


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
async def test_disabled_runtime_does_not_touch_persistence():
    repository = InMemoryTaskRepository()
    clock = FrozenClock(datetime(2026, 8, 9, tzinfo=timezone.utc))
    runtime = runtime_service(repository, clock, enabled=False)

    assert await runtime.start() is None
    assert runtime.started is False
    assert repository.tables == {}
    assert repository.rpc_calls == []


@pytest.mark.asyncio
async def test_enabled_runtime_registers_heartbeats_and_drains_worker():
    repository = InMemoryTaskRepository()
    clock = FrozenClock(datetime(2026, 8, 9, tzinfo=timezone.utc))
    runtime = runtime_service(repository, clock)

    worker = await runtime.start()
    assert worker is not None
    assert worker.worker_id == "worker-a"
    assert worker.status is WorkerStatus.HEALTHY

    heartbeat = await runtime.heartbeat()
    assert heartbeat is not None
    assert heartbeat.status is WorkerStatus.HEALTHY
    assert ("hermes_worker_heartbeat", {"p_worker_id": "worker-a"}) in repository.rpc_calls

    stopped = await runtime.stop()
    assert stopped is not None
    assert stopped.status is WorkerStatus.OFFLINE


@pytest.mark.asyncio
async def test_restart_recovers_existing_active_lease_and_releases_it_once():
    repository = InMemoryTaskRepository()
    clock = FrozenClock(datetime(2026, 8, 9, tzinfo=timezone.utc))
    first = runtime_service(repository, clock)
    await first.start()
    await repository.create_row(
        "hermes_worker_leases",
        {
            "lease_id": "lease-existing",
            "task_id": TASK_ID,
            "worker_id": "worker-a",
            "capabilities": ["task-dispatch"],
            "acquired_at": clock.current.isoformat(),
            "renewed_at": clock.current.isoformat(),
            "expires_at": (clock.current + timedelta(seconds=60)).isoformat(),
            "status": LeaseStatus.ACTIVE.value,
        },
    )

    restarted = runtime_service(repository, clock)
    await restarted.start()
    recovered = restarted.recoverable_leases()

    assert [item.lease_id for item in recovered] == ["lease-existing"]
    released = await restarted.release("lease-existing")
    assert released.status is LeaseStatus.RELEASED
    assert restarted.recoverable_leases() == ()
    assert any(name == "hermes_release_worker_lease" for name, _ in repository.rpc_calls)


@pytest.mark.asyncio
async def test_claim_next_task_uses_atomic_rpc_and_returns_locked_task_with_lease():
    repository = InMemoryTaskRepository()
    clock = FrozenClock(datetime(2026, 8, 9, tzinfo=timezone.utc))
    runtime = runtime_service(repository, clock)
    await runtime.start()
    repository.tables["hermes_workers"][0].update(
        {"active_leases": 1, "version_counter": 2}
    )
    repository.rpc_results["hermes_claim_capability_task"] = [
        {
            "task_id": TASK_ID,
            "lease_id": "lease-claimed",
            "title": "Claimed task",
            "description": None,
            "task_type": "generic",
            "input_data": {"source": "test"},
            "agent_name": "TARS",
            "correlation_id": None,
            "retry_count": 0,
            "task_status": "LOCKED",
            "worker_id": "worker-a",
            "capabilities": ["task-dispatch"],
            "acquired_at": clock.current.isoformat(),
            "renewed_at": clock.current.isoformat(),
            "expires_at": (clock.current + timedelta(seconds=60)).isoformat(),
            "lease_status": "active",
        }
    ]

    claim = await runtime.claim_next_task()

    assert claim is not None
    assert claim.task["status"] == "LOCKED"
    assert claim.lease.status is LeaseStatus.ACTIVE
    assert claim.lease.lease_id == "lease-claimed"
    assert any(
        name == "hermes_claim_capability_task" for name, _ in repository.rpc_calls
    )
