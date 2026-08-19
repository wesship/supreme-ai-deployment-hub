"""Production adapters implementing the Hermes orchestration ports."""

from __future__ import annotations

import json
from typing import Any

from backend.hermes.infrastructure import HermesDispatchClient, SupabaseRestClient


class SupabaseTaskRepository:
    """TaskRepository implementation backed by Supabase REST."""

    def __init__(self, client: SupabaseRestClient) -> None:
        self._client = client

    @property
    def configured(self) -> bool:
        return self._client.configured

    async def list_rows(self, table: str, params: dict[str, Any]) -> list[dict[str, Any]]:
        return await self._client.get(table, params)

    async def create_row(self, table: str, payload: dict[str, Any]) -> dict[str, Any]:
        return await self._client.post(table, payload)

    async def rpc(self, function_name: str, params: dict[str, Any]) -> Any:
        return await self._client.rpc(function_name, params)

    async def update_row(
        self,
        table: str,
        row_id: str,
        payload: dict[str, Any],
    ) -> dict[str, Any]:
        return await self._client.patch(table, row_id, payload)

    async def update_row_if(
        self,
        table: str,
        row_id: str,
        payload: dict[str, Any],
        conditions: dict[str, Any],
    ) -> dict[str, Any]:
        filters = {key: f"eq.{value}" for key, value in conditions.items()}
        return await self._client.patch(table, row_id, payload, filters=filters)


class SupabaseCheckpointStore:
    """CheckpointStore implementation using the existing hermes_checkpoints table."""

    def __init__(self, repository: SupabaseTaskRepository) -> None:
        self._repository = repository

    @property
    def configured(self) -> bool:
        return self._repository.configured

    async def save(
        self,
        *,
        user_id: str,
        goal_id: str,
        execution_id: str,
        sequence: int,
        envelope: dict[str, Any],
    ) -> dict[str, Any]:
        return await self._repository.create_row(
            "hermes_checkpoints",
            {
                "user_id": user_id,
                "goal_id": goal_id,
                "title": self._title(execution_id, sequence),
                "content": json.dumps(envelope, sort_keys=True, separators=(",", ":")),
            },
        )

    async def latest(
        self,
        *,
        goal_id: str,
        execution_id: str,
    ) -> dict[str, Any] | None:
        rows = await self._repository.list_rows(
            "hermes_checkpoints",
            {
                "goal_id": f"eq.{goal_id}",
                "title": f"like.workflow:{execution_id}:checkpoint:*",
                "order": "title.desc",
                "limit": "1",
            },
        )
        return self._decode(rows[0]) if rows else None

    async def get(
        self,
        *,
        goal_id: str,
        execution_id: str,
        sequence: int,
    ) -> dict[str, Any] | None:
        rows = await self._repository.list_rows(
            "hermes_checkpoints",
            {
                "goal_id": f"eq.{goal_id}",
                "title": f"eq.{self._title(execution_id, sequence)}",
                "limit": "1",
            },
        )
        return self._decode(rows[0]) if rows else None

    @staticmethod
    def _title(execution_id: str, sequence: int) -> str:
        return f"workflow:{execution_id}:checkpoint:{sequence:020d}"

    @staticmethod
    def _decode(row: dict[str, Any]) -> dict[str, Any]:
        content = row.get("content")
        if not isinstance(content, str):
            raise ValueError("checkpoint content must be JSON text")
        decoded = json.loads(content)
        if not isinstance(decoded, dict):
            raise ValueError("checkpoint content must decode to an object")
        return decoded


class EdgeFunctionAgentDispatcher:
    """AgentDispatcher implementation backed by the enqueue-task Edge Function."""

    def __init__(self, client: HermesDispatchClient) -> None:
        self._client = client

    @property
    def configured(self) -> bool:
        return self._client.configured

    async def dispatch(
        self,
        *,
        task_id: str,
        agent_name: str,
        input_data: dict[str, Any],
        idempotency_key: str | None = None,
    ) -> dict[str, Any]:
        payload: dict[str, Any] = {
            "task_id": task_id,
            "agent": agent_name,
            "input": input_data,
        }
        if idempotency_key:
            payload["idempotency_key"] = idempotency_key
        return await self._client.enqueue(
            payload,
            include_service_authorization=True,
            signature_header="x-hermes-signature",
        )


class RepositoryEventSink:
    """EventSink implementation that persists lifecycle events to hermes_logs."""

    def __init__(self, repository: SupabaseTaskRepository) -> None:
        self._repository = repository

    async def emit(self, event: dict[str, Any]) -> None:
        await self._repository.create_row("hermes_logs", event)
