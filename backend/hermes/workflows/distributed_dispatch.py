"""Worker-aware distributed task delivery with deterministic acknowledgement semantics."""

from __future__ import annotations

from dataclasses import dataclass, field
from datetime import datetime, timedelta
from enum import Enum
from hashlib import sha256
from typing import Any, Protocol, runtime_checkable

from backend.hermes.ports.clock import Clock, SystemClock
from backend.hermes.workflows.workers import (
    InMemoryWorkerRegistry,
    LeaseStatus,
    WorkerLease,
    WorkerRegistryError,
)


class DeliveryStatus(str, Enum):
    PENDING = "pending"
    DELIVERED = "delivered"
    ACKNOWLEDGED = "acknowledged"
    COMPLETED = "completed"
    FAILED = "failed"
    EXPIRED = "expired"


@dataclass(frozen=True)
class WorkerTaskEnvelope:
    schema_version: str
    delivery_id: str
    task_id: str
    lease_id: str
    worker_id: str
    agent_name: str
    input_data: dict[str, Any]
    idempotency_key: str
    created_at: datetime
    expires_at: datetime
    attempt: int = 1
    metadata: dict[str, Any] = field(default_factory=dict)


@dataclass
class DeliveryRecord:
    envelope: WorkerTaskEnvelope
    status: DeliveryStatus = DeliveryStatus.PENDING
    delivered_at: datetime | None = None
    acknowledged_at: datetime | None = None
    completed_at: datetime | None = None
    error: str | None = None


@runtime_checkable
class WorkerTransport(Protocol):
    @property
    def configured(self) -> bool: ...

    async def publish(self, envelope: WorkerTaskEnvelope) -> dict[str, Any]: ...


class InMemoryWorkerTransport:
    """Deterministic transport adapter for tests and local orchestration."""

    def __init__(self) -> None:
        self.messages: dict[str, WorkerTaskEnvelope] = {}
        self.order: list[str] = []

    @property
    def configured(self) -> bool:
        return True

    async def publish(self, envelope: WorkerTaskEnvelope) -> dict[str, Any]:
        if envelope.delivery_id not in self.messages:
            self.messages[envelope.delivery_id] = envelope
            self.order.append(envelope.delivery_id)
        return {
            "delivery_id": envelope.delivery_id,
            "accepted": True,
            "duplicate": self.messages[envelope.delivery_id] is not envelope,
        }


class DistributedTaskDispatcher:
    """Binds tasks to worker leases and publishes idempotent delivery envelopes."""

    SCHEMA_VERSION = "hermes.worker-task.v1"

    def __init__(
        self,
        *,
        registry: InMemoryWorkerRegistry,
        transport: WorkerTransport,
        clock: Clock | None = None,
        acknowledgement_timeout: timedelta = timedelta(seconds=30),
    ) -> None:
        self.registry = registry
        self.transport = transport
        self.clock = clock or SystemClock()
        self.acknowledgement_timeout = acknowledgement_timeout
        self.deliveries: dict[str, DeliveryRecord] = {}
        self.task_deliveries: dict[str, str] = {}

    @property
    def configured(self) -> bool:
        return self.transport.configured

    async def dispatch(
        self,
        *,
        task_id: str,
        agent_name: str,
        input_data: dict[str, Any],
        required_capabilities: tuple[str, ...] = (),
        idempotency_key: str | None = None,
        metadata: dict[str, Any] | None = None,
    ) -> dict[str, Any]:
        existing_id = self.task_deliveries.get(task_id)
        if existing_id:
            existing = self.deliveries[existing_id]
            if existing.status in {
                DeliveryStatus.PENDING,
                DeliveryStatus.DELIVERED,
                DeliveryStatus.ACKNOWLEDGED,
            }:
                return self._result(existing, duplicate=True)

        lease = self.registry.acquire_lease(
            task_id=task_id,
            required_capabilities=required_capabilities,
        )
        self._assert_active_lease(lease)
        now = self.clock.now()
        attempt = 1 + sum(
            record.envelope.task_id == task_id for record in self.deliveries.values()
        )
        stable_key = idempotency_key or f"hermes:{task_id}:attempt:{attempt}"
        delivery_id = self._delivery_id(task_id, lease.lease_id, stable_key)
        envelope = WorkerTaskEnvelope(
            schema_version=self.SCHEMA_VERSION,
            delivery_id=delivery_id,
            task_id=task_id,
            lease_id=lease.lease_id,
            worker_id=lease.worker_id,
            agent_name=agent_name,
            input_data=dict(input_data),
            idempotency_key=stable_key,
            created_at=now,
            expires_at=min(lease.expires_at, now + self.acknowledgement_timeout),
            attempt=attempt,
            metadata=dict(metadata or {}),
        )
        record = DeliveryRecord(envelope=envelope)
        self.deliveries[delivery_id] = record
        self.task_deliveries[task_id] = delivery_id
        await self.transport.publish(envelope)
        record.status = DeliveryStatus.DELIVERED
        record.delivered_at = self.clock.now()
        return self._result(record, duplicate=False)

    def acknowledge(self, *, delivery_id: str, worker_id: str, lease_id: str) -> DeliveryRecord:
        record = self._record(delivery_id)
        self._validate_ownership(record, worker_id=worker_id, lease_id=lease_id)
        if record.status in {DeliveryStatus.ACKNOWLEDGED, DeliveryStatus.COMPLETED}:
            return record
        if record.status != DeliveryStatus.DELIVERED:
            raise WorkerRegistryError(f"delivery {delivery_id} is not awaiting acknowledgement")
        record.status = DeliveryStatus.ACKNOWLEDGED
        record.acknowledged_at = self.clock.now()
        return record

    def complete(
        self,
        *,
        delivery_id: str,
        worker_id: str,
        lease_id: str,
        error: str | None = None,
    ) -> DeliveryRecord:
        record = self._record(delivery_id)
        self._validate_ownership(record, worker_id=worker_id, lease_id=lease_id)
        if record.status in {DeliveryStatus.COMPLETED, DeliveryStatus.FAILED}:
            return record
        if record.status not in {DeliveryStatus.DELIVERED, DeliveryStatus.ACKNOWLEDGED}:
            raise WorkerRegistryError(f"delivery {delivery_id} cannot complete from {record.status.value}")
        record.status = DeliveryStatus.FAILED if error else DeliveryStatus.COMPLETED
        record.error = error
        record.completed_at = self.clock.now()
        self.registry.release_lease(lease_id, cancelled=bool(error))
        return record

    def sweep_expired(self) -> list[DeliveryRecord]:
        now = self.clock.now()
        expired: list[DeliveryRecord] = []
        self.registry.sweep()
        for record in self.deliveries.values():
            if record.status not in {DeliveryStatus.PENDING, DeliveryStatus.DELIVERED}:
                continue
            lease = self.registry.leases.get(record.envelope.lease_id)
            if record.envelope.expires_at <= now or not lease or lease.status != LeaseStatus.ACTIVE:
                record.status = DeliveryStatus.EXPIRED
                record.error = "acknowledgement deadline or worker lease expired"
                if self.task_deliveries.get(record.envelope.task_id) == record.envelope.delivery_id:
                    self.task_deliveries.pop(record.envelope.task_id, None)
                expired.append(record)
        return sorted(expired, key=lambda item: item.envelope.delivery_id)

    @staticmethod
    def _delivery_id(task_id: str, lease_id: str, idempotency_key: str) -> str:
        digest = sha256(f"{task_id}|{lease_id}|{idempotency_key}".encode()).hexdigest()[:24]
        return f"delivery_{digest}"

    def _record(self, delivery_id: str) -> DeliveryRecord:
        try:
            return self.deliveries[delivery_id]
        except KeyError as exc:
            raise WorkerRegistryError(f"unknown delivery {delivery_id}") from exc

    def _validate_ownership(self, record: DeliveryRecord, *, worker_id: str, lease_id: str) -> None:
        if record.envelope.worker_id != worker_id or record.envelope.lease_id != lease_id:
            raise WorkerRegistryError("delivery ownership does not match worker lease")
        lease = self.registry.leases.get(lease_id)
        self._assert_active_lease(lease)
        if lease.worker_id != worker_id or lease.task_id != record.envelope.task_id:
            raise WorkerRegistryError("active lease does not authorize this delivery")

    @staticmethod
    def _assert_active_lease(lease: WorkerLease | None) -> None:
        if not lease or lease.status != LeaseStatus.ACTIVE:
            raise WorkerRegistryError("an active worker lease is required")

    @staticmethod
    def _result(record: DeliveryRecord, *, duplicate: bool) -> dict[str, Any]:
        return {
            "delivery_id": record.envelope.delivery_id,
            "task_id": record.envelope.task_id,
            "worker_id": record.envelope.worker_id,
            "lease_id": record.envelope.lease_id,
            "status": record.status.value,
            "duplicate": duplicate,
            "attempt": record.envelope.attempt,
        }
