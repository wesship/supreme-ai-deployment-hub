"""Durable-workflow boundary for HealthOS."""
from dataclasses import dataclass, field
from typing import Any, Protocol


class WorkflowAdapter(Protocol):
    async def start(self, workflow_name: str, workflow_id: str, payload: dict[str, Any]) -> str: ...


@dataclass
class InMemoryWorkflowAdapter:
    started: list[dict[str, Any]] = field(default_factory=list)

    async def start(self, workflow_name: str, workflow_id: str, payload: dict[str, Any]) -> str:
        self.started.append({"workflow_name": workflow_name, "workflow_id": workflow_id, "payload": payload})
        return workflow_id
