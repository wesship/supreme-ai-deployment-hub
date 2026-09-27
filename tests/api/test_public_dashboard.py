from datetime import datetime, timezone

from fastapi import FastAPI
from fastapi.testclient import TestClient

from backend.api import public_dashboard as dashboard


def _client() -> TestClient:
    app = FastAPI()
    app.include_router(dashboard.router)
    return TestClient(app)


def test_dashboard_key_is_optional_but_enforced_when_configured(monkeypatch):
    monkeypatch.setattr(dashboard, "DASHBOARD_KEY", "secret")
    response = _client().get("/api/public/dashboard")
    assert response.status_code == 401


def test_public_dashboard_aggregates_existing_sources(monkeypatch):
    monkeypatch.setattr(dashboard, "DASHBOARD_KEY", "")
    monkeypatch.setattr(dashboard, "GRAPH_TABLES", ("knowledge_nodes",))

    now = datetime.now(timezone.utc).isoformat()
    activity = [
        {
            "id": "1",
            "created_at": now,
            "agent_id": "hermes",
            "agent_name": "Hermes",
            "event_type": "started",
            "session_id": "session-1",
            "duration_ms": None,
            "status": "success",
        },
        {
            "id": "2",
            "created_at": now,
            "agent_id": "research",
            "agent_name": "Research",
            "event_type": "completed",
            "session_id": "session-2",
            "duration_ms": 100,
            "status": "success",
        },
    ]
    costs = [
        {
            "id": "c1",
            "created_at": now,
            "cost_usd": 0.25,
            "status": "success",
            "model": "test-model",
            "provider": "test-provider",
        }
    ]

    async def fake_query(table, **kwargs):
        if table == "agent_activity_logs":
            return activity
        if table == "ai_request_logs":
            return costs
        return None

    async def fake_health():
        return {
            "overall": "healthy",
            "uptime_percent": 100.0,
            "checked_at": now,
            "components": [{"name": "api", "status": "healthy"}],
        }

    async def fake_count(table):
        return 12 if table == "knowledge_nodes" else None

    monkeypatch.setattr(dashboard, "_query", fake_query)
    monkeypatch.setattr(dashboard, "_health_summary", fake_health)
    monkeypatch.setattr(dashboard, "_count_table", fake_count)

    response = _client().get("/api/public/dashboard")
    assert response.status_code == 200
    payload = response.json()
    assert payload["status"] == "live"
    assert payload["metrics"]["active_agents"] == 1
    assert payload["metrics"]["running_tasks"] == 1
    assert payload["metrics"]["success_rate_percent"] == 100.0
    assert payload["metrics"]["uptime_percent"] == 100.0
    assert payload["cost_usage"]["total_usd"] == 0.25
    assert payload["graph_nodes"]["knowledge_nodes"] == 12
    assert payload["bridges"] is None
    assert payload["execution_flow"] is None
