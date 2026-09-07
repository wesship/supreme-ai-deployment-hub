from __future__ import annotations

import json

import pytest

from backend.intelligence.worldmonitor.client import WorldMonitorConfig
from backend.intelligence.worldmonitor.normalizer import normalize_tool_result
from backend.intelligence.worldmonitor.service import WorldMonitorIngestionService


def test_normalizes_infrastructure_outage_from_mcp_text_block():
    result = {
        "content": [
            {
                "type": "text",
                "text": json.dumps(
                    {
                        "outages": [
                            {
                                "id": "outage-1",
                                "provider": "Example Cloud",
                                "title": "Regional API degradation",
                                "severity": "high",
                                "country": "US",
                                "updated_at": "2026-09-07T10:00:00Z",
                            }
                        ]
                    }
                ),
            }
        ]
    }

    events = normalize_tool_result("get_infrastructure_status", result)

    assert len(events) == 1
    event = events[0]
    assert event.domain == "infrastructure"
    assert event.event_type == "infrastructure_outage"
    assert event.severity == 0.8
    assert event.raw_source_id == "outage-1"
    assert event.entities[0].name == "Example Cloud"


def test_world_brief_is_one_normalized_aggregate_event():
    result = {
        "structuredContent": {
            "title": "Global situation brief",
            "summary": "Current multi-domain intelligence snapshot.",
            "confidence": 91,
        }
    }

    events = normalize_tool_result("get_world_brief", result)

    assert len(events) == 1
    assert events[0].domain == "global"
    assert events[0].event_type == "world_brief"
    assert events[0].confidence == 0.91


def test_worldmonitor_config_never_requires_browser_configuration():
    config = WorldMonitorConfig(api_key="wm_test")
    assert config.mcp_url == "https://worldmonitor.app/mcp"
    assert "D3VONN-Intelligence" in config.user_agent


@pytest.mark.asyncio
async def test_ingestion_persists_and_dispatches_to_hermes(monkeypatch):
    class FakeClient:
        configured = True

        async def call_tool(self, name, arguments):
            assert name == "get_cyber_threats"
            return {
                "structuredContent": {
                    "threats": [
                        {
                            "id": "threat-7",
                            "title": "Credential attack campaign",
                            "severity": "critical",
                            "country": "US",
                        }
                    ]
                }
            }

    class FakeStore:
        configured = True

        def __init__(self):
            self.rows = []

        async def post(self, table, payload):
            assert table == "intelligence_events"
            self.rows.append(payload)
            return {"id": "intel-1", **payload}

    async def fake_existing(correlation_id):
        assert correlation_id == "worldmonitor:threat-7"
        return None

    async def fake_create_task(**payload):
        assert payload["task_type"] == "intelligence.worldmonitor.correlate"
        assert payload["agent_name"] == "tars"
        assert payload["priority"] == 10
        return {"id": "task-1", **payload}

    async def fake_dispatch_to_agent(**payload):
        assert payload["agent_name"] == "tars"
        assert payload["idempotency_key"] == "worldmonitor:threat-7"
        return {"status": "queued"}

    async def fake_log_event(**payload):
        return None

    monkeypatch.setattr(
        "backend.intelligence.worldmonitor.service.get_task_by_correlation_id",
        fake_existing,
    )
    monkeypatch.setattr(
        "backend.intelligence.worldmonitor.service.create_task",
        fake_create_task,
    )
    monkeypatch.setattr(
        "backend.intelligence.worldmonitor.service.dispatch_to_agent",
        fake_dispatch_to_agent,
    )
    monkeypatch.setattr(
        "backend.intelligence.worldmonitor.service.log_event",
        fake_log_event,
    )

    store = FakeStore()
    service = WorldMonitorIngestionService(client=FakeClient(), store=store)
    output = await service.ingest("get_cyber_threats")

    assert output["event_count"] == 1
    assert output["persisted_count"] == 1
    assert output["hermes_task_count"] == 1
    assert store.rows[0]["domain"] == "cyber"


@pytest.mark.asyncio
async def test_rejects_non_allowlisted_tool():
    class FakeClient:
        configured = True

    class FakeStore:
        configured = False

    service = WorldMonitorIngestionService(client=FakeClient(), store=FakeStore())
    with pytest.raises(ValueError, match="not allowlisted"):
        await service.ingest("search_flights")
