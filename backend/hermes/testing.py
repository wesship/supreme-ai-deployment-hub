"""In-memory Hermes adapters for fast deterministic orchestration tests."""

from __future__ import annotations

from copy import deepcopy
from dataclasses import dataclass, field
from datetime import datetime
from typing import Any
from uuid import uuid4


@dataclass
class FrozenClock:
    current: datetime

    def now(self) -> datetime:
        return self.current


@dataclass
class InMemoryTaskRepository:
    configured: bool = True
    tables: dict[str, list[dict[str, Any]]] = field(default_factory=dict)

    async def list_rows(self, table: str, params: dict[str, Any]) -> list[dict[str, Any]]:
        rows = deepcopy(self.tables.get(table, []))
        for key, value in params.items():
            if key in {"order", "limit"}:
                continue
            if isinstance(value, str) and value.startswith("eq."):
                expected = value[3:]
                rows = [row for row in rows if str(row.get(key)) == expected]
        limit = int(params.get("limit", len(rows)))
        return rows[:limit]

    async def create_row(self, table: str, payload: dict[str, Any]) -> dict[str, Any]:
        row = {"id": str(uuid4()), **deepcopy(payload)}
        self.tables.setdefault(table, []).append(row)
        return deepcopy(row)

    async def update_row(
        self,
        table: str,
        row_id: str,
        payload: dict[str, Any],
    ) -> dict[str, Any]:
        for row in self.tables.setdefault(table, []):
            if str(row.get("id")) == row_id:
                row.update(deepcopy(payload))
                return deepcopy(row)
        return {}


@dataclass
class InMemoryAgentDispatcher:
    configured: bool = True
    calls: list[dict[str, Any]] = field(default_factory=list)

    async def dispatch(
        self,
        *,
        task_id: str,
        agent_name: str,
        input_data: dict[str, Any],
    ) -> dict[str, Any]:
        call = {"task_id": task_id, "agent": agent_name, "input": deepcopy(input_data)}
        self.calls.append(call)
        return {"status": "queued", **call}


@dataclass
class InMemoryEventSink:
    events: list[dict[str, Any]] = field(default_factory=list)

    async def emit(self, event: dict[str, Any]) -> None:
        self.events.append(deepcopy(event))
