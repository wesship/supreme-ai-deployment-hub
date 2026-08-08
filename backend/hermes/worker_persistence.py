"""Supabase persistence adapter and restart reconstruction for Hermes workers."""

from __future__ import annotations

from datetime import datetime
from typing import Any

from backend.hermes.adapters import SupabaseTaskRepository
from backend.hermes.ports.clock import Clock
from backend.hermes.workflows.workers import (
    InMemoryWorkerRegistry,
    LeaseStatus,
    WorkerCapabilities,
    WorkerLease,
    WorkerRecord,
    WorkerRegistryPolicy,
    WorkerStatus,
)


class WorkerVersionConflict(RuntimeError):
    """Raised when optimistic worker version validation fails."""


class SupabaseWorkerRegistryStore:
    """Durable worker/lease storage using the shared Supabase repository adapter."""

    def __init__(self, repository: SupabaseTaskRepository) -> None:
        self._repository = repository

    @property
    def configured(self) -> bool:
        return self._repository.configured

    async def upsert_worker(self, payload: dict[str, Any]) -> dict[str, Any]:
        worker_id = str(payload["worker_id"])
        rows = await self._repository.list_rows(
            "hermes_workers", {"worker_id": f"eq.{worker_id}", "limit": "1"}
        )
        if not rows:
            return await self._repository.create_row(
                "hermes_workers", {**payload, "version_counter": int(payload.get("version_counter", 1))}
            )
        return await self.update_worker(worker_id, payload)

    async def update_worker(
        self,
        worker_id: str,
        payload: dict[str, Any],
        *,
        expected_version: int | None = None,
    ) -> dict[str, Any]:
        rows = await self._repository.list_rows(
            "hermes_workers", {"worker_id": f"eq.{worker_id}", "limit": "1"}
        )
        if not rows:
            raise KeyError(f"unknown worker {worker_id}")
        row = rows[0]
        current_version = int(row.get("version_counter", 1))
        if expected_version is not None and current_version != expected_version:
            raise WorkerVersionConflict(
                f"worker {worker_id} version {current_version} != expected {expected_version}"
            )
        next_payload = {**payload, "version_counter": current_version + 1}
        if expected_version is None:
            return await self._repository.update_row(
                "hermes_workers",
                str(row["id"]),
                next_payload,
            )
        updated = await self._repository.update_row_if(
            "hermes_workers",
            str(row["id"]),
            next_payload,
            {"version_counter": expected_version},
        )
        if not updated:
            raise WorkerVersionConflict(
                f"worker {worker_id} changed while version {expected_version} was being updated"
            )
        return updated

    async def list_workers(self) -> list[dict[str, Any]]:
        return await self._repository.list_rows(
            "hermes_workers", {"order": "worker_id.asc", "limit": "1000"}
        )

    async def create_lease(self, payload: dict[str, Any]) -> dict[str, Any]:
        active = await self._repository.list_rows(
            "hermes_worker_leases",
            {
                "task_id": f"eq.{payload['task_id']}",
                "status": f"eq.{LeaseStatus.ACTIVE.value}",
                "limit": "1",
            },
        )
        if active:
            return active[0]
        return await self._repository.create_row("hermes_worker_leases", payload)

    async def update_lease(self, lease_id: str, payload: dict[str, Any]) -> dict[str, Any]:
        rows = await self._repository.list_rows(
            "hermes_worker_leases", {"lease_id": f"eq.{lease_id}", "limit": "1"}
        )
        if not rows:
            raise KeyError(f"unknown lease {lease_id}")
        return await self._repository.update_row(
            "hermes_worker_leases", str(rows[0]["id"]), payload
        )

    async def get_lease(self, lease_id: str) -> dict[str, Any] | None:
        rows = await self._repository.list_rows(
            "hermes_worker_leases", {"lease_id": f"eq.{lease_id}", "limit": "1"}
        )
        return rows[0] if rows else None

    async def list_leases(self, *, active_only: bool = False) -> list[dict[str, Any]]:
        page_size = 1000
        offset = 0
        rows: list[dict[str, Any]] = []
        while True:
            params: dict[str, Any] = {
                "order": "acquired_at.asc",
                "limit": str(page_size),
                "offset": str(offset),
            }
            if active_only:
                params["status"] = f"eq.{LeaseStatus.ACTIVE.value}"
            page = await self._repository.list_rows("hermes_worker_leases", params)
            rows.extend(page)
            if len(page) < page_size:
                return rows
            offset += len(page)


class PersistentWorkerRegistry:
    """Coordinates domain registry state with durable worker storage."""

    def __init__(
        self,
        *,
        store: SupabaseWorkerRegistryStore,
        clock: Clock,
        policy: WorkerRegistryPolicy | None = None,
    ) -> None:
        self.store = store
        self.clock = clock
        self.policy = policy or WorkerRegistryPolicy()
        self.registry = InMemoryWorkerRegistry(clock=clock, policy=self.policy)

    async def restore(self) -> InMemoryWorkerRegistry:
        restored = InMemoryWorkerRegistry(clock=self.clock, policy=self.policy)
        for row in await self.store.list_workers():
            worker = self._decode_worker(row)
            restored.workers[worker.worker_id] = worker
        for worker in restored.workers.values():
            worker.active_leases = 0
        for row in await self.store.list_leases(active_only=False):
            lease = self._decode_lease(row)
            restored.leases[lease.lease_id] = lease
            if lease.status == LeaseStatus.ACTIVE:
                restored.task_leases[lease.task_id] = lease.lease_id
                worker = restored.workers.get(lease.worker_id)
                if worker is not None:
                    worker.active_leases += 1
        for worker in restored.workers.values():
            if worker.status not in {
                WorkerStatus.DRAINING,
                WorkerStatus.OFFLINE,
                WorkerStatus.LOST,
            }:
                worker.status = (
                    WorkerStatus.BUSY
                    if worker.active_leases >= worker.max_leases
                    else WorkerStatus.HEALTHY
                )
        self.registry = restored
        expired = self.registry.sweep()
        for lease in expired:
            await self.store.update_lease(
                lease.lease_id, {"status": lease.status.value}
            )
        for worker in self.registry.workers.values():
            await self.store.update_worker(
                worker.worker_id,
                self._worker_payload(worker),
            )
        return self.registry

    async def persist_worker(self, worker: WorkerRecord) -> dict[str, Any]:
        return await self.store.upsert_worker(self._worker_payload(worker))

    async def persist_lease(self, lease: WorkerLease) -> dict[str, Any]:
        payload = self._lease_payload(lease)
        existing = await self.store.get_lease(lease.lease_id)
        if existing is not None:
            return await self.store.update_lease(lease.lease_id, payload)
        return await self.store.create_lease(payload)

    @staticmethod
    def _worker_payload(worker: WorkerRecord) -> dict[str, Any]:
        return {
            "worker_id": worker.worker_id,
            "hostname": worker.hostname,
            "region": worker.region,
            "runtime": worker.runtime,
            "runtime_version": worker.version,
            "capabilities": sorted(worker.capabilities.names),
            "cpu_cores": worker.capabilities.cpu_cores,
            "memory_mb": worker.capabilities.memory_mb,
            "gpu_count": worker.capabilities.gpu_count,
            "max_leases": worker.max_leases,
            "active_leases": worker.active_leases,
            "status": worker.status.value,
            "registered_at": worker.registered_at.isoformat(),
            "last_heartbeat_at": worker.last_heartbeat_at.isoformat(),
            "metadata": worker.metadata,
        }

    @staticmethod
    def _lease_payload(lease: WorkerLease) -> dict[str, Any]:
        return {
            "lease_id": lease.lease_id,
            "task_id": lease.task_id,
            "worker_id": lease.worker_id,
            "capabilities": list(lease.capabilities),
            "acquired_at": lease.acquired_at.isoformat(),
            "renewed_at": lease.renewed_at.isoformat(),
            "expires_at": lease.expires_at.isoformat(),
            "status": lease.status.value,
        }

    @staticmethod
    def _decode_worker(row: dict[str, Any]) -> WorkerRecord:
        return WorkerRecord(
            worker_id=str(row["worker_id"]),
            hostname=str(row["hostname"]),
            region=str(row["region"]),
            runtime=str(row["runtime"]),
            version=str(row["runtime_version"]),
            capabilities=WorkerCapabilities.from_names(
                row.get("capabilities") or [],
                cpu_cores=float(row.get("cpu_cores", 1)),
                memory_mb=int(row.get("memory_mb", 512)),
                gpu_count=int(row.get("gpu_count", 0)),
            ),
            max_leases=int(row["max_leases"]),
            active_leases=int(row.get("active_leases", 0)),
            registered_at=datetime.fromisoformat(str(row["registered_at"])),
            last_heartbeat_at=datetime.fromisoformat(str(row["last_heartbeat_at"])),
            status=WorkerStatus(str(row["status"])),
            metadata=dict(row.get("metadata") or {}),
        )

    @staticmethod
    def _decode_lease(row: dict[str, Any]) -> WorkerLease:
        return WorkerLease(
            lease_id=str(row["lease_id"]),
            task_id=str(row["task_id"]),
            worker_id=str(row["worker_id"]),
            capabilities=tuple(row.get("capabilities") or ()),
            acquired_at=datetime.fromisoformat(str(row["acquired_at"])),
            renewed_at=datetime.fromisoformat(str(row["renewed_at"])),
            expires_at=datetime.fromisoformat(str(row["expires_at"])),
            status=LeaseStatus(str(row["status"])),
        )
