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
    rpc_results: dict[str, Any] = field(default_factory=dict)
    rpc_calls: list[tuple[str, dict[str, Any]]] = field(default_factory=list)

    async def list_rows(self, table: str, params: dict[str, Any]) -> list[dict[str, Any]]:
        rows = deepcopy(self.tables.get(table, []))
        for key, value in params.items():
            if key in {"order", "limit", "offset"}:
                continue
            if isinstance(value, str) and value.startswith("eq."):
                expected = value[3:]
                rows = [row for row in rows if str(row.get(key)) == expected]
            elif isinstance(value, str) and value.startswith("like."):
                pattern = value[5:].replace("%", "").replace("*", "")
                rows = [row for row in rows if pattern in str(row.get(key, ""))]
        if params.get("order") == "created_at.desc":
            rows.sort(key=lambda row: str(row.get("created_at", "")), reverse=True)
        elif params.get("order") == "title.desc":
            rows.sort(key=lambda row: str(row.get("title", "")), reverse=True)
        if params.get("order") == "acquired_at.asc":
            rows.sort(key=lambda row: str(row.get("acquired_at", "")))
        offset = int(params.get("offset", 0))
        limit = int(params.get("limit", len(rows)))
        return rows[offset : offset + limit]

    async def create_row(self, table: str, payload: dict[str, Any]) -> dict[str, Any]:
        row = {"id": str(uuid4()), **deepcopy(payload)}
        self.tables.setdefault(table, []).append(row)
        return deepcopy(row)

    async def rpc(self, function_name: str, params: dict[str, Any]) -> Any:
        self.rpc_calls.append((function_name, deepcopy(params)))
        if function_name in self.rpc_results:
            return deepcopy(self.rpc_results[function_name])
        if function_name in {"hermes_reap_stale_workers", "hermes_reap_stale_leases"}:
            return 0
        if function_name == "hermes_worker_heartbeat":
            worker_id = str(params["p_worker_id"])
            for row in self.tables.get("hermes_workers", []):
                if str(row.get("worker_id")) == worker_id:
                    row["version_counter"] = int(row.get("version_counter", 1)) + 1
                    return deepcopy(row)
            return None
        if function_name == "hermes_renew_worker_lease":
            lease_id = str(params["p_lease_id"])
            for row in self.tables.get("hermes_worker_leases", []):
                if str(row.get("lease_id")) == lease_id and row.get("status") == "active":
                    return deepcopy(row)
            return None
        if function_name == "hermes_release_worker_lease":
            lease_id = str(params["p_lease_id"])
            for row in self.tables.get("hermes_worker_leases", []):
                if str(row.get("lease_id")) == lease_id and row.get("status") == "active":
                    row["status"] = str(params["p_status"])
                    return deepcopy(row)
            return None
        return None

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

    async def update_row_if(
        self,
        table: str,
        row_id: str,
        payload: dict[str, Any],
        conditions: dict[str, Any],
    ) -> dict[str, Any]:
        for row in self.tables.setdefault(table, []):
            if str(row.get("id")) != row_id:
                continue
            if any(str(row.get(key)) != str(value) for key, value in conditions.items()):
                return {}
            row.update(deepcopy(payload))
            return deepcopy(row)
        return {}


@dataclass
class InMemoryCheckpointStore:
    configured: bool = True
    records: list[dict[str, Any]] = field(default_factory=list)

    async def save(
        self,
        *,
        user_id: str,
        goal_id: str,
        execution_id: str,
        sequence: int,
        envelope: dict[str, Any],
    ) -> dict[str, Any]:
        record = {
            "id": str(uuid4()),
            "user_id": user_id,
            "goal_id": goal_id,
            "execution_id": execution_id,
            "sequence": sequence,
            "envelope": deepcopy(envelope),
        }
        self.records.append(record)
        return deepcopy(record)

    async def latest(
        self,
        *,
        goal_id: str,
        execution_id: str,
    ) -> dict[str, Any] | None:
        matches = [
            record
            for record in self.records
            if record["goal_id"] == goal_id and record["execution_id"] == execution_id
        ]
        if not matches:
            return None
        return deepcopy(max(matches, key=lambda record: int(record["sequence"]))["envelope"])

    async def get(
        self,
        *,
        goal_id: str,
        execution_id: str,
        sequence: int,
    ) -> dict[str, Any] | None:
        for record in self.records:
            if (
                record["goal_id"] == goal_id
                and record["execution_id"] == execution_id
                and record["sequence"] == sequence
            ):
                return deepcopy(record["envelope"])
        return None


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
        idempotency_key: str | None = None,
    ) -> dict[str, Any]:
        call: dict[str, Any] = {
            "task_id": task_id,
            "agent": agent_name,
            "input": deepcopy(input_data),
        }
        if idempotency_key is not None:
            call["idempotency_key"] = idempotency_key
        self.calls.append(call)
        return {"status": "queued", **call}


@dataclass
class InMemoryEventSink:
    events: list[dict[str, Any]] = field(default_factory=list)

    async def emit(self, event: dict[str, Any]) -> None:
        self.events.append(deepcopy(event))
