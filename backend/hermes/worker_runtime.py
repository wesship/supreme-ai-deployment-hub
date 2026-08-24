"""Default-off production activation layer for durable Hermes worker state."""

from __future__ import annotations

import os
import platform
import socket
from dataclasses import dataclass
from datetime import timedelta
from typing import Iterable

from backend.hermes.ports import Clock, TaskRepository
from backend.hermes.worker_persistence import PersistentWorkerRegistry
from backend.hermes.workflows.workers import (
    LeaseStatus,
    WorkerCapabilities,
    WorkerLease,
    WorkerRecord,
    WorkerRegistryError,
    WorkerRegistryPolicy,
    WorkerStatus,
)


def _env_bool(name: str, default: bool = False) -> bool:
    value = os.getenv(name)
    if value is None:
        return default
    normalized = value.strip().lower()
    if normalized in {"1", "true", "yes", "on"}:
        return True
    if normalized in {"0", "false", "no", "off"}:
        return False
    raise ValueError(f"{name} must be a boolean value")


def _normalize_capabilities(capabilities: Iterable[str]) -> tuple[str, ...]:
    return tuple(
        sorted({item.strip().lower() for item in capabilities if item.strip()})
    )


@dataclass(frozen=True, slots=True)
class PersistentWorkerRuntimeConfig:
    enabled: bool = False
    worker_id: str = "hermes-worker"
    hostname: str = "localhost"
    region: str = "unknown"
    capabilities: tuple[str, ...] = ("task-dispatch",)
    max_leases: int = 1
    heartbeat_timeout_seconds: float = 90.0
    lease_ttl_seconds: float = 300.0

    @classmethod
    def from_env(cls) -> "PersistentWorkerRuntimeConfig":
        hostname = socket.gethostname()
        capabilities = _normalize_capabilities(
            os.getenv("HERMES_WORKER_CAPABILITIES", "task-dispatch").split(",")
        )
        if "task-dispatch" not in capabilities:
            capabilities = ("task-dispatch", *capabilities)
        return cls(
            enabled=_env_bool("HERMES_PERSISTENT_WORKERS_ENABLED", False),
            worker_id=os.getenv("HERMES_WORKER_ID", hostname),
            hostname=hostname,
            region=os.getenv("HERMES_WORKER_REGION", "unknown"),
            capabilities=capabilities,
            max_leases=int(os.getenv("HERMES_MAX_CONCURRENT_TASKS", "10")),
            heartbeat_timeout_seconds=float(
                os.getenv("HERMES_WORKER_HEARTBEAT_TIMEOUT_SECONDS", "90")
            ),
            lease_ttl_seconds=float(
                os.getenv("HERMES_WORKER_LEASE_TTL_SECONDS", "300")
            ),
        )

    def policy(self) -> WorkerRegistryPolicy:
        return WorkerRegistryPolicy(
            heartbeat_timeout=timedelta(seconds=self.heartbeat_timeout_seconds),
            lease_ttl=timedelta(seconds=self.lease_ttl_seconds),
        )


class PersistentWorkerRuntime:
    """Own one process worker record and its durable task leases."""

    def __init__(
        self,
        *,
        persistence: PersistentWorkerRegistry,
        config: PersistentWorkerRuntimeConfig,
        clock: Clock,
    ) -> None:
        self.persistence = persistence
        self.config = config
        self.clock = clock
        self.started = False

    @property
    def worker_id(self) -> str:
        return self.config.worker_id

    async def start(self) -> WorkerRecord | None:
        if not self.config.enabled:
            return None
        if not self.persistence.store.configured:
            raise RuntimeError(
                "persistent Hermes workers require configured Supabase service-role access"
            )
        await self.persistence.restore()
        registry = self.persistence.registry
        existing = registry.workers.get(self.worker_id)
        if existing is None or existing.status in {
            WorkerStatus.OFFLINE,
            WorkerStatus.LOST,
        }:
            worker = registry.register(
                worker_id=self.worker_id,
                hostname=self.config.hostname,
                region=self.config.region,
                runtime="python",
                version=platform.python_version(),
                capabilities=WorkerCapabilities.from_names(
                    self.config.capabilities
                ),
                max_leases=self.config.max_leases,
                metadata={"persistent_runtime": True},
            )
        else:
            worker = registry.heartbeat(
                self.worker_id,
                metadata={"persistent_runtime": True},
            )
        await self.persistence.persist_worker(worker)
        self.started = True
        return worker

    async def heartbeat(self) -> WorkerRecord | None:
        if not self.started:
            return None
        await self.persistence.sweep()
        return await self.persistence.heartbeat_worker(self.worker_id)

    async def acquire(
        self,
        task_id: str,
        *,
        required_capabilities: Iterable[str] = (),
    ) -> WorkerLease | None:
        if not self.started:
            return None
        await self.persistence.sweep()
        required = _normalize_capabilities(required_capabilities)
        if "task-dispatch" not in required:
            required = ("task-dispatch", *required)
        try:
            lease = await self.persistence.acquire_for_worker(
                worker_id=self.worker_id,
                task_id=task_id,
                required_capabilities=required,
            )
        except WorkerRegistryError:
            return None
        if lease.worker_id != self.worker_id or lease.status is not LeaseStatus.ACTIVE:
            return None
        return lease

    async def renew(self, lease_id: str) -> WorkerLease:
        return await self.persistence.renew_lease(lease_id)

    async def release(
        self,
        lease_id: str,
        *,
        cancelled: bool = False,
    ) -> WorkerLease:
        return await self.persistence.release_lease(
            lease_id,
            cancelled=cancelled,
        )

    def recoverable_leases(self) -> tuple[WorkerLease, ...]:
        if not self.started:
            return ()
        leases = (
            lease
            for lease in self.persistence.registry.leases.values()
            if lease.worker_id == self.worker_id
            and lease.status is LeaseStatus.ACTIVE
        )
        return tuple(sorted(leases, key=lambda item: (item.task_id, item.lease_id)))

    async def stop(self) -> WorkerRecord | None:
        if not self.started:
            return None
        worker = self.persistence.registry.drain(self.worker_id)
        await self.persistence.persist_worker(worker)
        self.started = False
        return worker


def build_persistent_worker_runtime(
    *,
    repository: TaskRepository,
    clock: Clock,
    config: PersistentWorkerRuntimeConfig | None = None,
) -> PersistentWorkerRuntime:
    from backend.hermes.worker_persistence import SupabaseWorkerRegistryStore

    runtime_config = config or PersistentWorkerRuntimeConfig.from_env()
    persistence = PersistentWorkerRegistry(
        store=SupabaseWorkerRegistryStore(repository),
        clock=clock,
        policy=runtime_config.policy(),
    )
    return PersistentWorkerRuntime(
        persistence=persistence,
        config=runtime_config,
        clock=clock,
    )
