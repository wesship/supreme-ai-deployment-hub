"""Event sink port for Hermes lifecycle and audit events."""

from __future__ import annotations

from typing import Any, Protocol, runtime_checkable


@runtime_checkable
class EventSink(Protocol):
    """Infrastructure-neutral lifecycle event destination."""

    async def emit(self, event: dict[str, Any]) -> None:
        ...
