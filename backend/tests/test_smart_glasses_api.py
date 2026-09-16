from fastapi import FastAPI
from fastapi.testclient import TestClient

import backend.app.routers.smart_glasses as smart_glasses


class _Nonces:
    def __init__(self):
        self.seen = set()

    async def reserve(self, device_id: str, nonce: str, ttl_seconds: int) -> bool:
        key = (device_id, nonce)
        if key in self.seen:
            return False
        self.seen.add(key)
        return True


def _client(monkeypatch) -> TestClient:
    monkeypatch.setenv("SMART_GLASSES_DEVICE_KEY", "test-device-key")
    monkeypatch.setenv("SMART_GLASSES_DEVICE_IDS", "glasses-01")
    monkeypatch.setenv("SMART_GLASSES_KILL_SWITCH", "false")
    nonces = _Nonces()

    async def _fake_nonce_store():
        return nonces

    monkeypatch.setattr(smart_glasses, "_nonce_store", _fake_nonce_store)
    app = FastAPI()
    app.include_router(smart_glasses.router, prefix="/api")
    return TestClient(app)


def _envelope(*, route: str, action: str, nonce: str = "nonce-0001", payload: dict | None = None) -> dict:
    return {
        "device_id": "glasses-01",
        "nonce": nonce,
        "correlation_id": "corr-01",
        "proposal": {"route": route, "call": {"name": action, "arguments": {}}},
        "payload": payload or {},
    }


def test_device_key_is_required(monkeypatch):
    client = _client(monkeypatch)
    response = client.post("/api/smart-glasses/v1/execute", json=_envelope(route="local", action="capture_photo"))
    assert response.status_code == 401


def test_local_capture_is_authorized_but_not_executed_server_side(monkeypatch):
    client = _client(monkeypatch)
    response = client.post(
        "/api/smart-glasses/v1/execute",
        json=_envelope(route="local", action="capture_photo"),
        headers={"X-D3VONN-Device-Key": "test-device-key"},
    )
    assert response.status_code == 200
    body = response.json()
    assert body["status"] == "local_execute"
    assert body["route"] == "local"
    assert body["action"] == "capture_photo"
    assert body["agent_used"] == "Needle"


def test_replay_is_denied(monkeypatch):
    client = _client(monkeypatch)
    payload = _envelope(route="local", action="capture_photo", nonce="nonce-replay")
    headers = {"X-D3VONN-Device-Key": "test-device-key"}
    first = client.post("/api/smart-glasses/v1/execute", json=payload, headers=headers)
    replay = client.post("/api/smart-glasses/v1/execute", json=payload, headers=headers)
    assert first.status_code == 200
    assert replay.status_code == 403
    assert replay.json()["detail"] == "replay_detected"


def test_guardian_action_never_dispatches_directly(monkeypatch):
    client = _client(monkeypatch)
    response = client.post(
        "/api/smart-glasses/v1/execute",
        json=_envelope(route="guardian_review", action="get_location"),
        headers={"X-D3VONN-Device-Key": "test-device-key"},
    )
    assert response.status_code == 200
    body = response.json()
    assert body["status"] == "guardian_review"
    assert body["route"] == "guardian_review"


def test_unknown_action_fails_closed(monkeypatch):
    client = _client(monkeypatch)
    response = client.post(
        "/api/smart-glasses/v1/execute",
        json=_envelope(route="local", action="unlock_door", nonce="nonce-unknown"),
        headers={"X-D3VONN-Device-Key": "test-device-key"},
    )
    assert response.status_code == 403
    assert response.json()["detail"] == "unknown_or_unapproved_action"


def test_internal_vision_fallback_handles_describe_scene(monkeypatch):
    client = _client(monkeypatch)
    monkeypatch.delenv("SMART_GLASSES_VISION_URL", raising=False)

    async def _fake_vision_action(*, action: str, payload: dict, correlation_id: str):
        assert action == "describe_scene"
        assert payload["image_data"].startswith("data:image/")
        assert correlation_id == "corr-01"
        return {"agent_used": "D3VONN Vision", "model_used": "test-model", "text": "A test scene."}

    monkeypatch.setattr(smart_glasses, "run_vision_action", _fake_vision_action)
    response = client.post(
        "/api/smart-glasses/v1/execute",
        json=_envelope(
            route="d3vonn_gateway",
            action="describe_scene",
            nonce="nonce-vision",
            payload={"image_data": "data:image/jpeg;base64,AA=="},
        ),
        headers={"X-D3VONN-Device-Key": "test-device-key"},
    )
    assert response.status_code == 200
    body = response.json()
    assert body["status"] == "completed"
    assert body["agent_used"] == "D3VONN Vision"
    assert body["model_used"] == "test-model"
    assert body["result"]["text"] == "A test scene."


def test_health_does_not_expose_secrets_and_reports_internal_vision(monkeypatch):
    client = _client(monkeypatch)
    monkeypatch.setenv("REDIS_URL", "redis://example.invalid:6379")
    monkeypatch.setenv("OPENAI_API_KEY", "test-openai-key")
    monkeypatch.delenv("SMART_GLASSES_VISION_URL", raising=False)
    response = client.get("/api/smart-glasses/v1/health")
    assert response.status_code == 200
    body = response.json()
    assert body["device_auth_configured"] is True
    assert body["vision_configured"] is True
    assert body["vision_mode"] == "internal"
    assert "test-device-key" not in response.text
    assert "test-openai-key" not in response.text
