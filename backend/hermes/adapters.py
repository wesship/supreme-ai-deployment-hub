"""Production adapters implementing the Hermes orchestration ports."""

from __future__ import annotations

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

    async def update_row(
        self,
        table: str,
        row_id: str,
        payload: dict[str, Any],
    ) -> dict[str, Any]:
        return await self._client.patch(table, row_id, payload)


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
    ) -> dict[str, Any]:
        return await self._client.enqueue(
            {"task_id": task_id, "agent": agent_name, "input": input_data},
            include_service_authorization=True,
            signature_header="x-hermes-signature",
        )


class RepositoryEventSink:
    """EventSink implementation that persists lifecycle events to hermes_logs."""

    def __init__(self, repository: SupabaseTaskRepository) -> None:
        self._repository = repository

    async def emit(self, event: dict[str, Any]) -> None:
        await self._repository.create_row("hermes_logs", event)
