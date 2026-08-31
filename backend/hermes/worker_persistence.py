"""Durable state for Hermes workers and database-authoritative leases."""
from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime
from typing import Any

from backend.hermes.ports import Clock, TaskRepository
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


@dataclass(frozen=True, slots=True)
class ClaimedTask:
    """A task locked atomically in PostgreSQL together with its active lease."""

    task: dict[str, Any]
    lease: WorkerLease


class SupabaseWorkerRegistryStore:
    """Durable worker/lease storage using the shared Supabase repository adapter."""

    def __init__(self, repository: TaskRepository) -> None:
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

    async def get_worker(self, worker_id: str) -> dict[str, Any] | None:
        rows = await self._repository.list_rows(
            "hermes_workers", {"worker_id": f"eq.{worker_id}", "limit": "1"}
        )
        return rows[0] if rows else None

    async def update_worker(
        self,
        worker_id: str,
        payload: dict[str, Any],
        *,
        expected_version: int | None = None,
    ) -> dict[str, Any]:
        row = await self.get_worker(worker_id)
        if row is None:
            raise KeyError(f"unknown worker {worker_id}")
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

    async def claim_next_task(
        self,
        *,
        worker_id: str,
        capabilities: tuple[str, ...],
        lease_ttl_seconds: int,
    ) -> dict[str, Any] | None:
        """Atomically select, lock, and lease one eligible task in PostgreSQL."""
        result = await self._repository.rpc(
            "hermes_claim_task",
            {
                "p_worker_id": worker_id,
                "p_capabilities": list(capabilities),
                "p_lease_ttl_seconds": lease_ttl_seconds,
            },
        )
        if isinstance(result, list):
            return result[0] if result else None
        return result if isinstance(result, dict) and result else None

    async def heartbeat_worker(self, worker_id: str) -> dict[str, Any]:
        result = await self._repository.rpc(
            "hermes_worker_heartbeat", {"p_worker_id": worker_id}
        )
        if isinstance(result, list):
            result = result[0] if result else None
        if not isinstance(result, dict) or not result:
            raise KeyError(f"unknown or inactive worker {worker_id}")
        return result

    async def renew_lease(
        self,
        lease_id: str,
        *,
        lease_ttl_seconds: int,
    ) -> dict[str, Any]:
        result = await self._repository.rpc(
            "hermes_renew_worker_lease",
            {
                "p_lease_id": lease_id,
                "p_lease_ttl_seconds": lease_ttl_seconds,
            },
        )
        if isinstance(result, list):
            result = result[0] if result else None
        if not isinstance(result, dict) or not result:
            raise KeyError(f"unknown or inactive lease {lease_id}")
        return result

    async def release_lease(
        self,
        lease_id: str,
        *,
        cancelled: bool,
    ) -> dict[str, Any]:
        result = await self._repository.rpc(
            "hermes_release_worker_lease",
            {
                "p_lease_id": lease_id,
                "p_status": LeaseStatus.CANCELLED.value if cancelled else LeaseStatus.RELEASED.value,
            },
        )
        if isinstance(result, list):
            result = result[0] if result else None
        if not isinstance(result, dict) or not result:
            raise KeyError(f"unknown or inactive lease {lease_id}")
        return result

    async def reap_stale_state(self, *, heartbeat_timeout_seconds: int) -> tuple[int, int]:
        """Reconcile dead workers and expired leases in database transaction scope."""
        dead_workers = await self._repository.rpc(
            "hermes_reap_stale_workers",
            {"p_stale_seconds": heartbeat_timeout_seconds},
        )
        expired_leases = await self._repository.rpc("hermes_reap_stale_leases", {})
        return int(dead_workers or 0), int(expired_leases or 0)

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
    """Coordinates local worker state with database-authoritative lease mutations."""

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
        self.worker_versions: dict[str, int] = {}

    async def restore(self) -> InMemoryWorkerRegistry:
        restored = InMemoryWorkerRegistry(clock=self.clock, policy=self.policy)
        self.worker_versions = {}
        for row in await self.store.list_workers():
            worker = self._decode_worker(row)
            restored.workers[worker.worker_id] = worker
            self.worker_versions[worker.worker_id] = int(row.get("version_counter", 1))
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
        return self.registry

    async def persist_worker(self, worker: WorkerRecord) -> dict[str, Any]:
        payload = self._worker_payload(worker)
        expected_version = self.worker_versions.get(worker.worker_id)
        if expected_version is None:
            row = await self.store.upsert_worker(payload)
        else:
            row = await self.store.update_worker(
                worker.worker_id,
                payload,
                expected_version=expected_version,
            )
        self.worker_versions[worker.worker_id] = int(
            row.get("version_counter", expected_version or 1)
        )
        return row

    async def claim_next_task(
        self,
        *,
        worker_id: str,
        required_capabilities: tuple[str, ...],
        lease_ttl_seconds: int,
    ) -> ClaimedTask | None:
        row = await self.store.claim_next_task(
            worker_id=worker_id,
            capabilities=required_capabilities,
            lease_ttl_seconds=lease_ttl_seconds,
        )
        if row is None:
            return None

        lease = self._decode_lease(
            {**row, "status": row.get("lease_status", LeaseStatus.ACTIVE.value)}
        )
        worker = self.registry.workers.get(worker_id)
        if worker is None:
            raise KeyError(f"unknown worker {worker_id}")
        self.registry.leases[lease.lease_id] = lease
        self.registry.task_leases[lease.task_id] = lease.lease_id
        worker.active_leases += 1
        worker.last_heartbeat_at = self.clock.now()
        worker.status = (
            WorkerStatus.BUSY
            if worker.active_leases >= worker.max_leases
            else WorkerStatus.HEALTHY
        )
        refreshed_worker = await self.store.get_worker(worker_id)
        if refreshed_worker is not None:
            self._replace_worker(refreshed_worker)

        return ClaimedTask(
            task={
                "id": str(row["task_id"]),
                "title": row["title"],
                "description": row.get("description"),
                "task_type": row["task_type"],
                "input_data": row.get("input_data") or {},
                "agent_name": row.get("agent_name"),
                "correlation_id": row.get("correlation_id"),
                "retry_count": int(row.get("retry_count", 0)),
                "status": row.get("task_status") or "LOCKED",
            },
            lease=lease,
        )

    async def heartbeat_worker(self, worker_id: str) -> WorkerRecord:
        row = await self.store.heartbeat_worker(worker_id)
        return self._replace_worker(row)

    async def renew_lease(self, lease_id: str, *, lease_ttl_seconds: int) -> WorkerLease:
        row = await self.store.renew_lease(
            lease_id,
            lease_ttl_seconds=lease_ttl_seconds,
        )
        lease = self._decode_lease(row)
        self.registry.leases[lease.lease_id] = lease
        self.registry.task_leases[lease.task_id] = lease.lease_id
        return lease

    async def release_lease(
        self,
        lease_id: str,
        *,
        cancelled: bool = False,
    ) -> WorkerLease:
        row = await self.store.release_lease(lease_id, cancelled=cancelled)
        lease = self._decode_lease(row)
        self.registry.leases[lease.lease_id] = lease
        self.registry.task_leases.pop(lease.task_id, None)
        refreshed_worker = await self.store.get_worker(lease.worker_id)
        if refreshed_worker is not None:
            self._replace_worker(refreshed_worker)
        return lease

    async def reap_stale_state(self, *, heartbeat_timeout_seconds: int) -> tuple[int, int]:
        return await self.store.reap_stale_state(
            heartbeat_timeout_seconds=heartbeat_timeout_seconds
        )

    def _replace_worker(self, row: dict[str, Any]) -> WorkerRecord:
        worker = self._decode_worker(row)
        self.registry.workers[worker.worker_id] = worker
        self.worker_versions[worker.worker_id] = int(row.get("version_counter", 1))
        return worker

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
