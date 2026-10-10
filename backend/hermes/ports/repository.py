"""Persistence port for Hermes tasks, runs, and lifecycle records."""

from __future__ import annotations

from typing import Any, Protocol, runtime_checkable


@runtime_checkable
class TaskRepository(Protocol):
    """Infrastructure-neutral persistence contract used by Hermes services."""

    @property
    def configured(self) -> bool:
        ...

    async def list_rows(self, table: str, params: dict[str, Any]) -> list[dict[str, Any]]:
        ...

    async def create_row(self, table: str, payload: dict[str, Any]) -> dict[str, Any]:
        ...

    async def rpc(self, function_name: str, params: dict[str, Any]) -> Any:
        ...

    async def update_row(
        self,
        table: str,
        row_id: str,
        payload: dict[str, Any],
    ) -> dict[str, Any]:
        ...

    async def update_row_if(
        self,
        table: str,
        row_id: str,
        payload: dict[str, Any],
        conditions: dict[str, Any],
    ) -> dict[str, Any]:
        ...
