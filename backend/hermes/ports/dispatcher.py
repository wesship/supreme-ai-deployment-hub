"""Dispatch port for sending work to registered Hermes agents."""

from __future__ import annotations

from typing import Any, Protocol, runtime_checkable


@runtime_checkable
class AgentDispatcher(Protocol):
    """Infrastructure-neutral agent dispatch contract."""

    @property
    def configured(self) -> bool:
        ...

    async def dispatch(
        self,
        *,
        task_id: str,
        agent_name: str,
        input_data: dict[str, Any],
        idempotency_key: str | None = None,
    ) -> dict[str, Any]:
        ...
