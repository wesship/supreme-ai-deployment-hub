"""Persistence contract for durable Hermes workflow checkpoints."""

from __future__ import annotations

from typing import Any, Protocol, runtime_checkable


@runtime_checkable
class CheckpointStore(Protocol):
    """Stores and retrieves versioned workflow checkpoint envelopes."""

    @property
    def configured(self) -> bool:
        ...

    async def save(
        self,
        *,
        user_id: str,
        goal_id: str,
        execution_id: str,
        sequence: int,
        envelope: dict[str, Any],
    ) -> dict[str, Any]:
        ...

    async def latest(
        self,
        *,
        goal_id: str,
        execution_id: str,
    ) -> dict[str, Any] | None:
        ...

    async def get(
        self,
        *,
        goal_id: str,
        execution_id: str,
        sequence: int,
    ) -> dict[str, Any] | None:
        ...
