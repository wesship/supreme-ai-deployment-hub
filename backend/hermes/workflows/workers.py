"""Distributed worker registration, health, leasing, and recovery primitives."""

from __future__ import annotations

from dataclasses import asdict, dataclass, field
from datetime import datetime, timedelta
from enum import Enum
from typing import Iterable
from uuid import uuid4

from backend.hermes.ports.clock import Clock, SystemClock


class WorkerStatus(str, Enum):
    HEALTHY = "healthy"
    BUSY = "busy"
    DRAINING = "draining"
    OFFLINE = "offline"
    LOST = "lost"


class LeaseStatus(str, Enum):
    ACTIVE = "active"
    RELEASED = "released"
    EXPIRED = "expired"
    CANCELLED = "cancelled"


@dataclass(frozen=True)
class WorkerCapabilities:
    names: frozenset[str] = field(default_factory=frozenset)
    cpu_cores: float = 1.0
    memory_mb: int = 512
    gpu_count: int = 0

    @classmethod
    def from_names(
        cls,
        names: Iterable[str],
        *,
        cpu_cores: float = 1.0,
        memory_mb: int = 512,
        gpu_count: int = 0,
    ) -> "WorkerCapabilities":
        return cls(
            names=frozenset(name.strip().lower() for name in names if name.strip()),
            cpu_cores=cpu_cores,
            memory_mb=memory_mb,
            gpu_count=gpu_count,
        )

    def supports(self, required: Iterable[str]) -> bool:
        return {item.strip().lower() for item in required}.issubset(self.names)


@dataclass
class WorkerRecord:
    worker_id: str
    hostname: str
    region: str
    runtime: str
    version: str
    capabilities: WorkerCapabilities
    max_leases: int
    registered_at: datetime
    last_heartbeat_at: datetime
    status: WorkerStatus = WorkerStatus.HEALTHY
    active_leases: int = 0
    metadata: dict[str, object] = field(default_factory=dict)

    @property
    def available_capacity(self) -> int:
        if self.status in {WorkerStatus.DRAINING, WorkerStatus.OFFLINE, WorkerStatus.LOST}:
            return 0
        return max(0, self.max_leases - self.active_leases)


@dataclass
class WorkerLease:
    lease_id: str
    task_id: str
    worker_id: str
    capabilities: tuple[str, ...]
    acquired_at: datetime
    expires_at: datetime
    renewed_at: datetime
    status: LeaseStatus = LeaseStatus.ACTIVE


@dataclass(frozen=True)
class WorkerRegistryPolicy:
    heartbeat_timeout: timedelta = timedelta(seconds=90)
    lease_ttl: timedelta = timedelta(minutes=5)


class WorkerRegistryError(RuntimeError):
    """Raised when worker or lease invariants are violated."""


class InMemoryWorkerRegistry:
    """Deterministic registry used by orchestration services and tests.

    A persistence adapter can implement the same public methods without changing
    scheduler or worker protocol semantics.
    """

    def __init__(self, *, clock: Clock | None = None, policy: WorkerRegistryPolicy | None = None):
        self.clock = clock or SystemClock()
        self.policy = policy or WorkerRegistryPolicy()
        self.workers: dict[str, WorkerRecord] = {}
        self.leases: dict[str, WorkerLease] = {}
        self.task_leases: dict[str, str] = {}

    def register(
        self,
        *,
        worker_id: str,
        hostname: str,
        region: str,
        runtime: str,
        version: str,
        capabilities: WorkerCapabilities,
        max_leases: int,
        metadata: dict[str, object] | None = None,
    ) -> WorkerRecord:
        if max_leases < 1:
            raise WorkerRegistryError("max_leases must be at least 1")
        now = self.clock.now()
        existing = self.workers.get(worker_id)
        if existing and existing.status not in {WorkerStatus.OFFLINE, WorkerStatus.LOST}:
            raise WorkerRegistryError(f"worker {worker_id} is already registered")
        record = WorkerRecord(
            worker_id=worker_id,
            hostname=hostname,
            region=region,
            runtime=runtime,
            version=version,
            capabilities=capabilities,
            max_leases=max_leases,
            registered_at=now,
            last_heartbeat_at=now,
            metadata=dict(metadata or {}),
        )
        self.workers[worker_id] = record
        return record

    def heartbeat(
        self,
        worker_id: str,
        *,
        active_leases: int | None = None,
        metadata: dict[str, object] | None = None,
    ) -> WorkerRecord:
        worker = self._worker(worker_id)
        if worker.status in {WorkerStatus.OFFLINE, WorkerStatus.LOST}:
            raise WorkerRegistryError(f"worker {worker_id} is not accepting heartbeats")
        worker.last_heartbeat_at = self.clock.now()
        if active_leases is not None:
            worker.active_leases = max(0, active_leases)
        if metadata:
            worker.metadata.update(metadata)
        if worker.status != WorkerStatus.DRAINING:
            worker.status = WorkerStatus.BUSY if worker.active_leases >= worker.max_leases else WorkerStatus.HEALTHY
        return worker

    def drain(self, worker_id: str) -> WorkerRecord:
        worker = self._worker(worker_id)
        worker.status = WorkerStatus.DRAINING
        if worker.active_leases == 0:
            worker.status = WorkerStatus.OFFLINE
        return worker

    def select_worker(self, required_capabilities: Iterable[str]) -> WorkerRecord | None:
        required = tuple(sorted({item.strip().lower() for item in required_capabilities}))
        candidates = [
            worker
            for worker in self.workers.values()
            if worker.available_capacity > 0 and worker.capabilities.supports(required)
        ]
        if not candidates:
            return None
        candidates.sort(
            key=lambda worker: (
                worker.active_leases / worker.max_leases,
                worker.region,
                worker.worker_id,
            )
        )
        return candidates[0]

    def acquire_lease(
        self,
        *,
        task_id: str,
        required_capabilities: Iterable[str] = (),
        ttl: timedelta | None = None,
    ) -> WorkerLease:
        existing_id = self.task_leases.get(task_id)
        if existing_id:
            existing = self.leases[existing_id]
            if existing.status == LeaseStatus.ACTIVE:
                return existing
        worker = self.select_worker(required_capabilities)
        if not worker:
            raise WorkerRegistryError("no eligible worker capacity")
        now = self.clock.now()
        lease = WorkerLease(
            lease_id=str(uuid4()),
            task_id=task_id,
            worker_id=worker.worker_id,
            capabilities=tuple(sorted({item.strip().lower() for item in required_capabilities})),
            acquired_at=now,
            renewed_at=now,
            expires_at=now + (ttl or self.policy.lease_ttl),
        )
        self.leases[lease.lease_id] = lease
        self.task_leases[task_id] = lease.lease_id
        worker.active_leases += 1
        worker.status = WorkerStatus.BUSY if worker.active_leases >= worker.max_leases else WorkerStatus.HEALTHY
        return lease

    def renew_lease(self, lease_id: str, *, ttl: timedelta | None = None) -> WorkerLease:
        lease = self._active_lease(lease_id)
        now = self.clock.now()
        lease.renewed_at = now
        lease.expires_at = now + (ttl or self.policy.lease_ttl)
        return lease

    def release_lease(self, lease_id: str, *, cancelled: bool = False) -> WorkerLease:
        lease = self._active_lease(lease_id)
        lease.status = LeaseStatus.CANCELLED if cancelled else LeaseStatus.RELEASED
        self.task_leases.pop(lease.task_id, None)
        worker = self._worker(lease.worker_id)
        worker.active_leases = max(0, worker.active_leases - 1)
        if worker.status == WorkerStatus.DRAINING and worker.active_leases == 0:
            worker.status = WorkerStatus.OFFLINE
        elif worker.status not in {WorkerStatus.LOST, WorkerStatus.OFFLINE}:
            worker.status = WorkerStatus.HEALTHY
        return lease

    def sweep(self) -> list[WorkerLease]:
        """Mark stale workers lost and expire their active leases."""
        now = self.clock.now()
        stale_ids = {
            worker.worker_id
            for worker in self.workers.values()
            if worker.status not in {WorkerStatus.OFFLINE, WorkerStatus.LOST}
            and now - worker.last_heartbeat_at > self.policy.heartbeat_timeout
        }
        for worker_id in stale_ids:
            self.workers[worker_id].status = WorkerStatus.LOST

        expired: list[WorkerLease] = []
        for lease in self.leases.values():
            if lease.status != LeaseStatus.ACTIVE:
                continue
            if lease.expires_at <= now or lease.worker_id in stale_ids:
                lease.status = LeaseStatus.EXPIRED
                self.task_leases.pop(lease.task_id, None)
                worker = self.workers.get(lease.worker_id)
                if worker:
                    worker.active_leases = max(0, worker.active_leases - 1)
                expired.append(lease)
        return sorted(expired, key=lambda item: (item.task_id, item.lease_id))

    def projection(self) -> dict[str, object]:
        workers = sorted(self.workers.values(), key=lambda item: (item.region, item.worker_id))
        active_leases = [lease for lease in self.leases.values() if lease.status == LeaseStatus.ACTIVE]
        return {
            "summary": {
                "workers_total": len(workers),
                "workers_healthy": sum(worker.status == WorkerStatus.HEALTHY for worker in workers),
                "workers_busy": sum(worker.status == WorkerStatus.BUSY for worker in workers),
                "workers_draining": sum(worker.status == WorkerStatus.DRAINING for worker in workers),
                "workers_lost": sum(worker.status == WorkerStatus.LOST for worker in workers),
                "active_leases": len(active_leases),
                "available_capacity": sum(worker.available_capacity for worker in workers),
            },
            "workers": [
                {
                    **asdict(worker),
                    "status": worker.status.value,
                    "capabilities": sorted(worker.capabilities.names),
                    "available_capacity": worker.available_capacity,
                }
                for worker in workers
            ],
        }

    def _worker(self, worker_id: str) -> WorkerRecord:
        try:
            return self.workers[worker_id]
        except KeyError as exc:
            raise WorkerRegistryError(f"unknown worker {worker_id}") from exc

    def _active_lease(self, lease_id: str) -> WorkerLease:
        try:
            lease = self.leases[lease_id]
        except KeyError as exc:
            raise WorkerRegistryError(f"unknown lease {lease_id}") from exc
        if lease.status != LeaseStatus.ACTIVE:
            raise WorkerRegistryError(f"lease {lease_id} is not active")
        return lease
