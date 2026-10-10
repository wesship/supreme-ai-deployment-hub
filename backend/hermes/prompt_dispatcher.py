"""Prompt-aware Hermes dispatch wrapper.

The static D3VONN authority chain remains outside the runtime registry:
constitution/policy -> GUARDIAN -> HERMES -> agent system prompt.

This wrapper may add one explicitly approved task/workflow prompt as supplemental
runtime material. It never replaces system instructions and it records the exact
prompt version/checksum used on the Hermes task and event ledger before dispatch.
"""

from __future__ import annotations

import logging
from typing import Any

from backend.hermes.ports import AgentDispatcher, TaskRepository

logger = logging.getLogger(__name__)


class PromptAwareDispatcher:
    """Decorate an AgentDispatcher with governed runtime-prompt resolution."""

    def __init__(
        self,
        repository: TaskRepository,
        downstream: AgentDispatcher,
        *,
        prompt_registry: Any | None = None,
    ) -> None:
        self._repository = repository
        self._downstream = downstream
        self._prompt_registry = prompt_registry

    @property
    def configured(self) -> bool:
        return self._downstream.configured

    def _registry(self) -> Any:
        if self._prompt_registry is not None:
            return self._prompt_registry
        # Lazy import avoids coupling Hermes module import to FastAPI settings.
        try:
            from app.services.prompt_registry import PromptRegistryService
        except ImportError:  # pragma: no cover - repository-root test execution
            from backend.app.services.prompt_registry import PromptRegistryService
        self._prompt_registry = PromptRegistryService()
        return self._prompt_registry

    async def dispatch(
        self,
        *,
        task_id: str,
        agent_name: str,
        input_data: dict[str, Any],
        idempotency_key: str | None = None,
    ) -> dict[str, Any]:
        enriched = dict(input_data)
        task = await self._get_task(task_id)
        task_type = str((task or {}).get("task_type") or "generic")
        hermes_meta = dict(enriched.get("_hermes") or {})
        workflow_id = hermes_meta.get("workflow_id")

        resolved = None
        try:
            registry = self._registry()
            resolved = await registry.resolve(
                scope="task",
                agent_id=agent_name,
                category=task_type,
            )
            if resolved is None and workflow_id:
                resolved = await registry.resolve(
                    scope="workflow",
                    agent_id=agent_name,
                    category=str(workflow_id),
                )
        except Exception as exc:  # noqa: BLE001
            # Registry availability must not take the orchestration plane down.
            # No external prompt is safer than an unverified fallback prompt.
            logger.warning("Hermes prompt resolution skipped for task %s: %s", task_id, exc)

        if resolved is not None:
            provenance = {
                "prompt_id": resolved.prompt_id,
                "prompt_version_id": resolved.version_id,
                "slug": resolved.slug,
                "source": resolved.source,
                "scope": resolved.scope,
                "checksum": resolved.checksum,
                "risk_score": resolved.risk_score,
                "quality_score": resolved.quality_score,
            }
            hermes_meta["runtime_prompt"] = {
                "authority": "supplemental",
                "content": resolved.content,
                "variables": dict(resolved.variables),
                "provenance": provenance,
            }
            enriched["_hermes"] = hermes_meta
            await self._persist_provenance(
                task_id=task_id,
                agent_name=agent_name,
                enriched_input=enriched,
                provenance=provenance,
            )

        return await self._downstream.dispatch(
            task_id=task_id,
            agent_name=agent_name,
            input_data=enriched,
            idempotency_key=idempotency_key,
        )

    async def _get_task(self, task_id: str) -> dict[str, Any] | None:
        rows = await self._repository.list_rows(
            "hermes_tasks",
            {"id": f"eq.{task_id}", "limit": "1"},
        )
        return rows[0] if rows else None

    async def _persist_provenance(
        self,
        *,
        task_id: str,
        agent_name: str,
        enriched_input: dict[str, Any],
        provenance: dict[str, Any],
    ) -> None:
        # Use the existing JSON input column rather than requiring a prompt-specific
        # Hermes schema migration. This keeps deploy order backward-compatible.
        try:
            await self._repository.update_row(
                "hermes_tasks",
                task_id,
                {"input_data": enriched_input},
            )
        except Exception as exc:  # noqa: BLE001
            logger.warning("Failed to persist prompt provenance on task %s: %s", task_id, exc)
            return

        try:
            await self._repository.create_row(
                "hermes_logs",
                {
                    "event": "prompt.resolved",
                    "level": "info",
                    "message": "Approved runtime prompt attached to Hermes dispatch",
                    "task_id": task_id,
                    "agent_name": agent_name,
                    "data": provenance,
                },
            )
        except Exception as exc:  # noqa: BLE001
            # Task provenance is canonical; observability failure must not block dispatch.
            logger.warning("Failed to emit prompt provenance event for task %s: %s", task_id, exc)
