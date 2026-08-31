"""Persistence port for distributed Hermes workers and leases."""

from __future__ import annotations

from typing import Any, Protocol, runtime_checkable


@runtime_checkable
class WorkerRegistryStore(Protocol):
    """Durable storage contract for worker and lease records."""

    @property
    def configured(self) -> bool: ...

    async def upsert_worker(self, payload: dict[str, Any]) -> dict[str, Any]: ...

    async def update_worker(
        self, worker_id: str, payload: dict[str, Any], *, expected_version: int | None = None
    ) -> dict[str, Any]: ...

    async def list_workers(self) -> list[dict[str, Any]]: ...

    async def claim_next_task(
        self,
        *,
        worker_id: str,
        capabilities: tuple[str, ...],
        lease_ttl_seconds: int,
    ) -> dict[str, Any] | None: ...

    async def update_lease(self, lease_id: str, payload: dict[str, Any]) -> dict[str, Any]: ...

    async def get_lease(self, lease_id: str) -> dict[str, Any] | None: ...

    async def list_leases(self, *, active_only: bool = False) -> list[dict[str, Any]]: ...
