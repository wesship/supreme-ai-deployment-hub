from fastapi import FastAPI
from fastapi.testclient import TestClient

import backend.marketplace.router as marketplace


def _row(**overrides):
    base = {
        "id": "11111111-1111-1111-1111-111111111111",
        "agent_name": "HERMES",
        "display_name": "Hermes Coordinator",
        "role": "orchestrator",
        "capabilities": ["task_planning", "agent_dispatch", "memory_management"],
        "status": "active",
        "created_at": "2026-05-29T17:45:41+00:00",
        "updated_at": "2026-05-29T17:45:41+00:00",
    }
    base.update(overrides)
    return base


def test_map_registry_row_is_truthful_and_normalized():
    agent = marketplace._map_registry_row(_row(), 5)

    assert agent["name"] == "Hermes Coordinator"
    assert agent["slug"] == "hermes"
    assert agent["category"] == "automation"
    assert agent["status"] == "published"
    assert agent["capabilities"] == ["task-planning", "agent-dispatch", "memory-management"]
    assert agent["pricing"] == {"model": "contact-sales"}
    assert agent["author"]["agentCount"] == 5
    assert agent["stats"] == {
        "downloads": 0,
        "activeInstalls": 0,
        "avgRating": 0,
        "reviewCount": 0,
        "lastUpdated": "2026-05-29T17:45:41+00:00",
    }
    assert agent["featured"] is False


def test_non_active_registry_agent_is_not_published():
    assert marketplace._map_registry_row(_row(status="disabled"), 1)["status"] == "deprecated"
    assert marketplace._map_registry_row(_row(status="review"), 1)["status"] == "pending-review"


def test_marketplace_endpoint_returns_registry_rows(monkeypatch):
    async def fake_fetch_registry_rows():
        return [_row()]

    monkeypatch.setattr(marketplace, "_fetch_registry_rows", fake_fetch_registry_rows)
    marketplace._cache["data"] = None
    marketplace._cache["ts"] = 0.0

    app = FastAPI()
    app.include_router(marketplace.router)
    response = TestClient(app).get("/api/marketplace/agents")

    assert response.status_code == 200
    body = response.json()
    assert body["source"] == "agent_registry"
    assert body["live"] is True
    assert body["count"] == 1
    assert body["agents"][0]["slug"] == "hermes"
