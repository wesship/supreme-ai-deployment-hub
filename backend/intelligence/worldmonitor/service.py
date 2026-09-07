from __future__ import annotations

from typing import Any

from backend.hermes.infrastructure import HermesInfrastructureConfig, SupabaseRestClient
from backend.hermes.task_engine import create_task, dispatch_to_agent, get_task_by_correlation_id, log_event

from .client import WorldMonitorClient
from .models import IntelligenceEvent
from .normalizer import normalize_tool_result

ALLOWED_TOOLS = frozenset(
    {
        "get_world_brief",
        "get_cyber_threats",
        "get_news_intelligence",
        "get_infrastructure_status",
        "get_research_signals",
        "get_market_data",
        "get_energy_intelligence",
        "get_chokepoint_status",
    }
)


class WorldMonitorIngestionService:
    """Fetch, normalize, persist, and optionally dispatch World Monitor signals to Hermes."""

    def __init__(
        self,
        client: WorldMonitorClient | None = None,
        store: SupabaseRestClient | None = None,
    ) -> None:
        self.client = client or WorldMonitorClient()
        self.store = store or SupabaseRestClient(HermesInfrastructureConfig.from_env())

    @property
    def configured(self) -> bool:
        return self.client.configured

    async def ingest(
        self,
        tool_name: str,
        arguments: dict[str, Any] | None = None,
        *,
        persist: bool = True,
        enqueue_hermes: bool = True,
    ) -> dict[str, Any]:
        if tool_name not in ALLOWED_TOOLS:
            raise ValueError(f"World Monitor tool not allowlisted: {tool_name}")

        result = await self.client.call_tool(tool_name, arguments or {})
        events = normalize_tool_result(tool_name, result)

        persisted: list[dict[str, Any]] = []
        tasks: list[dict[str, Any]] = []
        for event in events:
            row = await self._persist(event) if persist else {}
            if row:
                persisted.append(row)
            if enqueue_hermes:
                task = await self._handoff(event)
                if task:
                    tasks.append(task)

        return {
            "tool": tool_name,
            "event_count": len(events),
            "events": [event.model_dump(mode="json") for event in events],
            "persisted_count": len(persisted),
            "hermes_task_count": len(tasks),
            "hermes_tasks": tasks,
        }

    async def _persist(self, event: IntelligenceEvent) -> dict[str, Any]:
        if not self.store.configured:
            return {}

        existing = await self.store.get(
            "intelligence_events",
            {
                "source": f"eq.{event.source}",
                "fingerprint": f"eq.{event.raw_source_id}",
                "limit": "1",
            },
        )
        if existing:
            return existing[0]

        payload = event.model_dump(mode="json")
        payload["fingerprint"] = event.raw_source_id
        row = await self.store.post("intelligence_events", payload)
        await log_event(
            event="intelligence.worldmonitor.persisted",
            message=event.title or event.event_type,
            level="info",
            data={
                "source": event.source,
                "domain": event.domain,
                "event_type": event.event_type,
                "fingerprint": event.raw_source_id,
                "intelligence_event_id": row.get("id") if row else None,
            },
            correlation_id=f"worldmonitor:{event.raw_source_id}",
        )
        return row

    async def _handoff(self, event: IntelligenceEvent) -> dict[str, Any]:
        correlation_id = f"worldmonitor:{event.raw_source_id}"
        existing = await get_task_by_correlation_id(correlation_id)
        if existing:
            return existing

        task = await create_task(
            title=f"Correlate World Monitor signal: {event.title or event.event_type}",
            task_type="intelligence.worldmonitor.correlate",
            description="Correlate the normalized external intelligence signal with D3VONN internal telemetry, knowledge, and current goals.",
            agent_name="tars",
            input_data={"intelligence_event": event.model_dump(mode="json")},
            priority=self._priority(event.severity),
            source="worldmonitor",
            correlation_id=correlation_id,
        )
        if not task or not task.get("id"):
            return task

        dispatch = await dispatch_to_agent(
            agent_name="tars",
            task_id=task["id"],
            input_data={"intelligence_event": event.model_dump(mode="json")},
            idempotency_key=correlation_id,
        )
        return {**task, "dispatch": dispatch}

    @staticmethod
    def _priority(severity: float) -> int:
        if severity >= 0.85:
            return 10
        if severity >= 0.7:
            return 8
        if severity >= 0.5:
            return 6
        return 4
