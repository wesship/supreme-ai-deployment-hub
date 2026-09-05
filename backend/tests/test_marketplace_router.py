from fastapi import FastAPI
from fastapi.testclient import TestClient

import backend.marketplace.router as marketplace
from backend.app.middleware.auth import get_current_user_id

USER_ID = "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa"
INSTALLATION_ID = "22222222-2222-2222-2222-222222222222"


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


def _app():
    app = FastAPI()
    app.include_router(marketplace.router)
    app.dependency_overrides[get_current_user_id] = lambda: USER_ID
    return app


def test_map_registry_row_is_truthful_and_normalized():
    agent = marketplace._map_registry_row(_row(), 5)
    assert agent["name"] == "Hermes Coordinator"
    assert agent["slug"] == "hermes"
    assert agent["category"] == "automation"
    assert agent["status"] == "published"
    assert "task-planning" in agent["capabilities"]
    assert agent["pricing"] == {"model": "contact-sales"}
    assert agent["author"]["agentCount"] == 5
    assert agent["stats"]["downloads"] == 0
    assert agent["stats"]["activeInstalls"] == 0
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
    response = TestClient(_app()).get("/api/marketplace/agents")
    assert response.status_code == 200
    assert response.json()["source"] == "agent_registry"
    assert response.json()["agents"][0]["slug"] == "hermes"


def test_authenticated_installation_uses_server_authority(monkeypatch):
    async def fake_registry(agent_id: str):
        assert agent_id == _row()["id"]
        return _row()

    persisted = {}
    async def fake_persist(row):
        persisted.update(row)
        return {"id": INSTALLATION_ID, **row}

    audit = {}
    async def fake_audit(*, installation, actor_id, event_type, before_state):
        audit.update({"installation": installation, "actor_id": actor_id, "event_type": event_type, "before": before_state})

    monkeypatch.setattr(marketplace, "_fetch_registry_row", fake_registry)
    monkeypatch.setattr(marketplace, "_persist_installation", fake_persist)
    monkeypatch.setattr(marketplace, "_append_installation_event", fake_audit)

    response = TestClient(_app()).post(
        "/api/marketplace/installations",
        json={"agent_id": _row()["id"], "name": "Hermes Staging", "environment": "staging", "enabled_tools": ["hermes"]},
    )
    assert response.status_code == 201
    assert response.json()["authority"] == "server"
    assert persisted["user_id"] == USER_ID
    assert persisted["template_id"] == _row()["id"]
    assert persisted["status"] == "starting"
    assert "health_score" not in persisted
    assert "cpu_usage" not in persisted
    assert audit["event_type"] == "installed"
    assert audit["before"] is None


def test_installation_rejects_client_runtime_fields():
    response = TestClient(_app()).post(
        "/api/marketplace/installations",
        json={"agent_id": _row()["id"], "name": "Forged", "status": "running", "health_score": 100, "cpu_usage": 0},
    )
    assert response.status_code == 422


def test_start_transition_is_server_owned_and_audited(monkeypatch):
    installation = {"id": INSTALLATION_ID, "user_id": USER_ID, "template_id": _row()["id"], "name": "Hermes", "status": "stopped"}
    async def fake_fetch(*, installation_id, user_id):
        assert installation_id == INSTALLATION_ID and user_id == USER_ID
        return installation
    async def fake_transition(*, installation, actor_id, target, event_type):
        assert actor_id == USER_ID
        assert target == "starting"
        assert event_type == "lifecycle_start"
        return {**installation, "status": target}

    monkeypatch.setattr(marketplace, "_fetch_installation", fake_fetch)
    monkeypatch.setattr(marketplace, "_transition_with_audit", fake_transition)
    response = TestClient(_app()).post(f"/api/marketplace/installations/{INSTALLATION_ID}/lifecycle", json={"action": "start"})
    assert response.status_code == 200
    assert response.json() == {"id": INSTALLATION_ID, "status": "starting", "authority": "server"}


def test_invalid_start_transition_is_rejected(monkeypatch):
    async def fake_fetch(*, installation_id, user_id):
        return {"id": installation_id, "user_id": user_id, "status": "running"}
    monkeypatch.setattr(marketplace, "_fetch_installation", fake_fetch)
    response = TestClient(_app()).post(f"/api/marketplace/installations/{INSTALLATION_ID}/lifecycle", json={"action": "start"})
    assert response.status_code == 409


def test_uninstall_is_logical_revoke_with_audit(monkeypatch):
    installation = {"id": INSTALLATION_ID, "user_id": USER_ID, "template_id": _row()["id"], "name": "Hermes", "status": "running"}
    async def fake_fetch(*, installation_id, user_id):
        return installation
    async def fake_transition(*, installation, actor_id, target, event_type):
        assert target == "revoked"
        assert event_type == "uninstalled"
        return {**installation, "status": target}

    monkeypatch.setattr(marketplace, "_fetch_installation", fake_fetch)
    monkeypatch.setattr(marketplace, "_transition_with_audit", fake_transition)
    response = TestClient(_app()).delete(f"/api/marketplace/installations/{INSTALLATION_ID}")
    assert response.status_code == 200
    assert response.json()["status"] == "revoked"
    assert response.json()["authority"] == "server"
