from fastapi import FastAPI
from fastapi.testclient import TestClient

import backend.marketplace.router as marketplace
from backend.app.middleware.auth import get_current_user_id


def _row(**overrides):
    base = {
        "id": "11111111-1111-1111-1111-111111111111",
        "agent_name": "HERMES",
        "display_name": "Hermes Coordinator",
        "role": "orchestrator",
        "capabilities": ["task_planning", "agent_dispatch", "memory_management", "hermes", "publish"],
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
    assert "task-planning" in agent["capabilities"]
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


def test_authenticated_installation_uses_server_authority(monkeypatch):
    async def fake_registry(agent_id: str):
        assert agent_id == _row()["id"]
        return _row()

    persisted = {}

    async def fake_persist(row):
        persisted.update(row)
        return {"id": "22222222-2222-2222-2222-222222222222", **row}

    audit = {}

    async def fake_audit(*, installation, actor_id):
        audit["installation"] = installation
        audit["actor_id"] = actor_id

    monkeypatch.setattr(marketplace, "_fetch_registry_row", fake_registry)
    monkeypatch.setattr(marketplace, "_persist_installation", fake_persist)
    monkeypatch.setattr(marketplace, "_append_installation_event", fake_audit)

    app = FastAPI()
    app.include_router(marketplace.router)
    app.dependency_overrides[get_current_user_id] = lambda: "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa"

    response = TestClient(app).post(
        "/api/marketplace/installations",
        json={
            "agent_id": _row()["id"],
            "name": "Hermes Staging",
            "environment": "staging",
            "enabled_tools": ["hermes"],
        },
    )

    assert response.status_code == 201
    assert response.json()["authority"] == "server"
    assert persisted["user_id"] == "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa"
    assert persisted["template_id"] == _row()["id"]
    assert persisted["status"] == "starting"
    assert "health_score" not in persisted
    assert "cpu_usage" not in persisted
    assert audit["actor_id"] == "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa"


def test_installation_rejects_client_runtime_fields():
    app = FastAPI()
    app.include_router(marketplace.router)
    app.dependency_overrides[get_current_user_id] = lambda: "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa"

    response = TestClient(app).post(
        "/api/marketplace/installations",
        json={
            "agent_id": _row()["id"],
            "name": "Forged",
            "status": "running",
            "health_score": 100,
            "cpu_usage": 0,
        },
    )

    assert response.status_code == 422
