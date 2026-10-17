"""Temporal client boundary for HealthOS.

The import is intentionally lazy so the repository does not require Temporal
until the sandbox integration is explicitly enabled.
"""
from typing import Any

from backend.healthos.settings import HealthOSSettings


class TemporalWorkflowAdapter:
    def __init__(self, settings: HealthOSSettings, task_queue: str = "healthos-sandbox"):
        if not settings.enabled or not settings.temporal_enabled:
            raise RuntimeError("HealthOS Temporal adapter is disabled")
        if not settings.temporal_target:
            raise RuntimeError("HEALTHOS_TEMPORAL_TARGET is required")
        if not settings.synthetic_only:
            raise RuntimeError("Real-data Temporal mode is not enabled in Gate 4")
        self.target = settings.temporal_target
        self.task_queue = task_queue

    async def start(self, workflow_name: str, workflow_id: str, payload: dict[str, Any]) -> str:
        from temporalio.client import Client

        client = await Client.connect(self.target)
        handle = await client.start_workflow(
            workflow_name,
            payload,
            id=workflow_id,
            task_queue=self.task_queue,
        )
        return handle.id
