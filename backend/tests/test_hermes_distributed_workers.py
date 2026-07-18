from datetime import datetime, timedelta, timezone

import pytest

from backend.hermes.testing import FrozenClock
from backend.hermes.workflows.workers import (
    InMemoryWorkerRegistry,
    LeaseStatus,
    WorkerCapabilities,
    WorkerRegistryError,
    WorkerRegistryPolicy,
    WorkerStatus,
)


def registry() -> tuple[InMemoryWorkerRegistry, FrozenClock]:
    clock = FrozenClock(datetime(2026, 7, 18, 12, 0, tzinfo=timezone.utc))
    return (
        InMemoryWorkerRegistry(
            clock=clock,
            policy=WorkerRegistryPolicy(
                heartbeat_timeout=timedelta(seconds=30),
                lease_ttl=timedelta(seconds=20),
            ),
        ),
        clock,
    )


def register_worker(service: InMemoryWorkerRegistry, worker_id: str, *, region: str = "us-central"):
    return service.register(
        worker_id=worker_id,
        hostname=f"{worker_id}.internal",
        region=region,
        runtime="docker",
        version="1.0.0",
        capabilities=WorkerCapabilities.from_names(["llm", "browser"], cpu_cores=4, memory_mb=8192),
        max_leases=2,
    )


def test_registration_rejects_active_duplicate_worker_ids():
    service, _ = registry()
    register_worker(service, "worker-a")

    with pytest.raises(WorkerRegistryError, match="already registered"):
        register_worker(service, "worker-a")


def test_capability_selection_is_deterministic_and_capacity_aware():
    service, _ = registry()
    register_worker(service, "worker-b", region="us-west")
    register_worker(service, "worker-a", region="us-central")

    first = service.acquire_lease(task_id="task-1", required_capabilities=["llm"])
    second = service.acquire_lease(task_id="task-2", required_capabilities=["llm"])

    assert first.worker_id == "worker-a"
    assert second.worker_id == "worker-b"


def test_same_task_reuses_active_lease():
    service, _ = registry()
    register_worker(service, "worker-a")

    first = service.acquire_lease(task_id="task-1", required_capabilities=["browser"])
    second = service.acquire_lease(task_id="task-1", required_capabilities=["browser"])

    assert second.lease_id == first.lease_id
    assert service.workers["worker-a"].active_leases == 1


def test_lease_renewal_and_release_update_worker_capacity():
    service, clock = registry()
    register_worker(service, "worker-a")
    lease = service.acquire_lease(task_id="task-1", required_capabilities=["llm"])
    original_expiry = lease.expires_at

    clock.current += timedelta(seconds=5)
    service.renew_lease(lease.lease_id)
    assert lease.expires_at > original_expiry

    service.release_lease(lease.lease_id)
    assert lease.status == LeaseStatus.RELEASED
    assert service.workers["worker-a"].active_leases == 0
    assert service.workers["worker-a"].status == WorkerStatus.HEALTHY


def test_drain_stops_new_work_and_transitions_offline_after_release():
    service, _ = registry()
    register_worker(service, "worker-a")
    lease = service.acquire_lease(task_id="task-1", required_capabilities=["llm"])

    worker = service.drain("worker-a")
    assert worker.status == WorkerStatus.DRAINING
    with pytest.raises(WorkerRegistryError, match="no eligible worker capacity"):
        service.acquire_lease(task_id="task-2", required_capabilities=["llm"])

    service.release_lease(lease.lease_id)
    assert worker.status == WorkerStatus.OFFLINE


def test_stale_worker_expires_lease_for_recovery():
    service, clock = registry()
    register_worker(service, "worker-a")
    lease = service.acquire_lease(task_id="task-1", required_capabilities=["llm"])

    clock.current += timedelta(seconds=31)
    expired = service.sweep()

    assert [item.lease_id for item in expired] == [lease.lease_id]
    assert lease.status == LeaseStatus.EXPIRED
    assert service.workers["worker-a"].status == WorkerStatus.LOST
    assert "task-1" not in service.task_leases


def test_lease_deadline_expires_even_when_worker_is_healthy():
    service, clock = registry()
    register_worker(service, "worker-a")
    lease = service.acquire_lease(task_id="task-1", required_capabilities=["llm"])

    clock.current += timedelta(seconds=21)
    service.heartbeat("worker-a")
    expired = service.sweep()

    assert expired == [lease]
    assert lease.status == LeaseStatus.EXPIRED
    assert service.workers["worker-a"].status == WorkerStatus.HEALTHY


def test_projection_is_occ_ready():
    service, _ = registry()
    register_worker(service, "worker-a")
    service.acquire_lease(task_id="task-1", required_capabilities=["llm"])

    projection = service.projection()

    assert projection["summary"]["workers_total"] == 1
    assert projection["summary"]["active_leases"] == 1
    assert projection["summary"]["available_capacity"] == 1
    assert projection["workers"][0]["capabilities"] == ["browser", "llm"]
