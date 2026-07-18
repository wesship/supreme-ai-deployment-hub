from datetime import datetime, timedelta, timezone

import pytest

from backend.hermes.testing import FrozenClock
from backend.hermes.workflows.distributed_dispatch import (
    DeliveryStatus,
    DistributedTaskDispatcher,
    InMemoryWorkerTransport,
)
from backend.hermes.workflows.workers import (
    InMemoryWorkerRegistry,
    WorkerCapabilities,
    WorkerRegistryError,
    WorkerRegistryPolicy,
)


def build_dispatcher():
    clock = FrozenClock(datetime(2026, 7, 18, 12, 0, tzinfo=timezone.utc))
    registry = InMemoryWorkerRegistry(
        clock=clock,
        policy=WorkerRegistryPolicy(
            heartbeat_timeout=timedelta(seconds=60),
            lease_ttl=timedelta(seconds=45),
        ),
    )
    registry.register(
        worker_id="worker-a",
        hostname="worker-a.internal",
        region="us-central",
        runtime="docker",
        version="1.0.0",
        capabilities=WorkerCapabilities.from_names(["llm", "browser"]),
        max_leases=2,
    )
    transport = InMemoryWorkerTransport()
    dispatcher = DistributedTaskDispatcher(
        registry=registry,
        transport=transport,
        clock=clock,
        acknowledgement_timeout=timedelta(seconds=20),
    )
    return dispatcher, registry, transport, clock


@pytest.mark.asyncio
async def test_dispatch_creates_versioned_worker_envelope_and_lease():
    dispatcher, registry, transport, _ = build_dispatcher()

    result = await dispatcher.dispatch(
        task_id="task-1",
        agent_name="TARS",
        input_data={"goal": "plan"},
        required_capabilities=("llm",),
    )

    envelope = transport.messages[result["delivery_id"]]
    assert envelope.schema_version == "hermes.worker-task.v1"
    assert envelope.worker_id == "worker-a"
    assert envelope.task_id == "task-1"
    assert envelope.agent_name == "TARS"
    assert envelope.lease_id in registry.leases
    assert result["status"] == DeliveryStatus.DELIVERED.value


@pytest.mark.asyncio
async def test_duplicate_dispatch_reuses_active_delivery():
    dispatcher, _, transport, _ = build_dispatcher()

    first = await dispatcher.dispatch(
        task_id="task-1", agent_name="TARS", input_data={"goal": "plan"}
    )
    second = await dispatcher.dispatch(
        task_id="task-1", agent_name="TARS", input_data={"goal": "plan"}
    )

    assert second["delivery_id"] == first["delivery_id"]
    assert second["duplicate"] is True
    assert len(transport.messages) == 1


@pytest.mark.asyncio
async def test_acknowledgement_requires_matching_worker_and_lease():
    dispatcher, _, _, _ = build_dispatcher()
    result = await dispatcher.dispatch(
        task_id="task-1", agent_name="TARS", input_data={}
    )

    with pytest.raises(WorkerRegistryError, match="ownership"):
        dispatcher.acknowledge(
            delivery_id=result["delivery_id"],
            worker_id="worker-b",
            lease_id=result["lease_id"],
        )

    record = dispatcher.acknowledge(
        delivery_id=result["delivery_id"],
        worker_id=result["worker_id"],
        lease_id=result["lease_id"],
    )
    assert record.status == DeliveryStatus.ACKNOWLEDGED


@pytest.mark.asyncio
async def test_completion_releases_worker_capacity_idempotently():
    dispatcher, registry, _, _ = build_dispatcher()
    result = await dispatcher.dispatch(
        task_id="task-1", agent_name="TARS", input_data={}
    )

    dispatcher.acknowledge(
        delivery_id=result["delivery_id"],
        worker_id=result["worker_id"],
        lease_id=result["lease_id"],
    )
    first = dispatcher.complete(
        delivery_id=result["delivery_id"],
        worker_id=result["worker_id"],
        lease_id=result["lease_id"],
    )
    second = dispatcher.complete(
        delivery_id=result["delivery_id"],
        worker_id=result["worker_id"],
        lease_id=result["lease_id"],
    )

    assert first is second
    assert first.status == DeliveryStatus.COMPLETED
    assert registry.workers["worker-a"].active_leases == 0


@pytest.mark.asyncio
async def test_expired_unacknowledged_delivery_can_be_redelivered():
    dispatcher, registry, transport, clock = build_dispatcher()
    first = await dispatcher.dispatch(
        task_id="task-1", agent_name="TARS", input_data={}
    )

    clock.current += timedelta(seconds=21)
    expired = dispatcher.sweep_expired()
    assert expired[0].status == DeliveryStatus.EXPIRED

    second = await dispatcher.dispatch(
        task_id="task-1", agent_name="TARS", input_data={}
    )

    assert second["delivery_id"] != first["delivery_id"]
    assert second["attempt"] == 2
    assert len(transport.messages) == 2
    assert registry.workers["worker-a"].active_leases == 1


@pytest.mark.asyncio
async def test_failed_completion_cancels_lease():
    dispatcher, registry, _, _ = build_dispatcher()
    result = await dispatcher.dispatch(
        task_id="task-1", agent_name="TARS", input_data={}
    )

    record = dispatcher.complete(
        delivery_id=result["delivery_id"],
        worker_id=result["worker_id"],
        lease_id=result["lease_id"],
        error="worker execution failed",
    )

    assert record.status == DeliveryStatus.FAILED
    assert registry.leases[result["lease_id"]].status.value == "cancelled"
