"""Polling-worker integration tests for durable lease and restart semantics."""

from __future__ import annotations

from datetime import datetime, timedelta, timezone
from unittest.mock import AsyncMock

import pytest

from backend.hermes import worker
from backend.hermes.workflows.workers import WorkerLease


class RuntimeStub:
    worker_id = "worker-a"

    def __init__(self, lease: WorkerLease) -> None:
        self.lease = lease
        self.releases: list[tuple[str, bool]] = []

    async def release(self, lease_id: str, *, cancelled: bool = False) -> WorkerLease:
        self.releases.append((lease_id, cancelled))
        return self.lease


class StartupRuntimeStub:
    def __init__(self, failures: int) -> None:
        self.failures = failures
        self.attempts = 0

    async def start(self) -> None:
        self.attempts += 1
        if self.attempts <= self.failures:
            raise RuntimeError("database contract not ready")


def active_lease() -> WorkerLease:
    now = datetime(2026, 8, 9, tzinfo=timezone.utc)
    return WorkerLease(
        lease_id="lease-a",
        task_id="00000000-0000-0000-0000-000000000001",
        worker_id="worker-a",
        capabilities=("task-dispatch",),
        acquired_at=now,
        renewed_at=now,
        expires_at=now + timedelta(minutes=5),
    )


@pytest.mark.asyncio
async def test_startup_retries_until_database_contract_is_ready(monkeypatch):
    runtime = StartupRuntimeStub(failures=1)
    monkeypatch.setattr(worker, "_stop_event", worker.asyncio.Event())
    monkeypatch.setattr(worker, "STARTUP_RETRY_SECONDS", 0)

    assert await worker._start_runtime_with_retry(runtime) is True
    assert runtime.attempts == 2


@pytest.mark.asyncio
async def test_startup_stops_retrying_on_shutdown(monkeypatch):
    runtime = StartupRuntimeStub(failures=1)
    monkeypatch.setattr(worker, "_stop_event", worker.asyncio.Event())
    monkeypatch.setattr(worker, "STARTUP_RETRY_SECONDS", 60)

    async def stop_after_failure() -> None:
        while runtime.attempts == 0:
            await worker.asyncio.sleep(0)
        worker._stop_event.set()

    stopper = worker.asyncio.create_task(stop_after_failure())
    try:
        assert await worker._start_runtime_with_retry(runtime) is False
    finally:
        await stopper


@pytest.mark.asyncio
async def test_locked_task_dispatches_and_releases_its_atomic_lease(monkeypatch):
    lease = active_lease()
    runtime = RuntimeStub(lease)
    transition = AsyncMock(return_value={})
    dispatch = AsyncMock(return_value={"status": "queued"})
    monkeypatch.setattr(worker, "transition_task", transition)
    monkeypatch.setattr(worker, "dispatch_to_agent", dispatch)

    await worker._process_task(
        {
            "id": lease.task_id,
            "status": "LOCKED",
            "agent_name": "TARS",
            "input_data": {"goal": "test"},
        },
        runtime=runtime,
        recovered_lease=lease,
    )

    assert [call.args[1] for call in transition.await_args_list] == [
        "RUNNING",
        "COMPLETED",
    ]
    assert dispatch.await_args.kwargs["idempotency_key"] == (
        f"hermes-task:{lease.task_id}"
    )
    assert runtime.releases == [("lease-a", False)]


@pytest.mark.asyncio
async def test_restart_resumes_running_lease_with_same_dispatch_identity(monkeypatch):
    lease = active_lease()
    runtime = RuntimeStub(lease)
    transition = AsyncMock(return_value={})
    dispatch = AsyncMock(return_value={"status": "queued"})
    monkeypatch.setattr(worker, "transition_task", transition)
    monkeypatch.setattr(worker, "dispatch_to_agent", dispatch)

    await worker._process_task(
        {
            "id": lease.task_id,
            "status": "RUNNING",
            "agent_name": "ION",
            "input_data": {},
        },
        runtime=runtime,
        recovered_lease=lease,
    )

    assert [call.args[1] for call in transition.await_args_list] == ["COMPLETED"]
    assert dispatch.await_args.kwargs["idempotency_key"] == (
        f"hermes-task:{lease.task_id}"
    )
    assert runtime.releases == [("lease-a", False)]
