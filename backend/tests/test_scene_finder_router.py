from fastapi import FastAPI
from fastapi.testclient import TestClient

from backend.ai_films import scene_finder_router


def _client(monkeypatch):
    async def allow(_authorization):
        return {"id": "scene-finder-test-user"}

    monkeypatch.setattr(scene_finder_router, "_require_authenticated_user", allow)
    app = FastAPI()
    app.include_router(scene_finder_router.router, prefix="/api")
    return TestClient(app)


def test_scene_finder_search_returns_clip_hits(monkeypatch):
    calls = {}

    class FakeIndexClient:
        async def search(self, query, **kwargs):
            calls["query"] = query
            calls["kwargs"] = kwargs
            return {
                "data": [
                    {
                        "video_id": "video-1",
                        "start": 12.5,
                        "end": 21.0,
                        "score": 0.91,
                    }
                ]
            }

    monkeypatch.setattr(scene_finder_router, "TwelveLabsIndexClient", FakeIndexClient)
    client = _client(monkeypatch)

    response = client.post(
        "/api/ai-films/scene-finder/search",
        headers={"Authorization": "Bearer test"},
        json={"query": "slow tracking shot through a crowded club"},
    )

    assert response.status_code == 200
    body = response.json()
    assert body["surface"] == "scene-finder"
    assert body["count"] == 1
    assert body["scenes"][0]["video_id"] == "video-1"
    assert calls["query"] == "slow tracking shot through a crowded club"
    assert calls["kwargs"]["group_by"] == "clip"


def test_scene_blueprint_builds_original_adaptation_prompt(monkeypatch):
    calls = {}

    class FakeAnalyzeClient:
        async def analyze_asset(self, asset_id, prompt, **kwargs):
            calls["asset_id"] = asset_id
            calls["prompt"] = prompt
            calls["kwargs"] = kwargs
            return {"text": "scene dna"}

    monkeypatch.setattr(scene_finder_router, "TwelveLabsAnalyzeClient", FakeAnalyzeClient)
    client = _client(monkeypatch)

    response = client.post(
        "/api/ai-films/scene-finder/blueprint",
        headers={"Authorization": "Bearer test"},
        json={
            "asset_id": "asset-123",
            "objective": "Adapt the camera movement for an original underground market scene.",
            "start_time": 10,
            "end_time": 18,
        },
    )

    assert response.status_code == 200
    body = response.json()
    assert body["surface"] == "scene-blueprint"
    assert body["window"] == {"start_time": 10.0, "end_time": 18.0}
    assert calls["asset_id"] == "asset-123"
    assert "materially original" in calls["prompt"]
    assert "Do not reproduce copyrighted dialogue" in calls["prompt"]
    assert calls["kwargs"]["start_time"] == 10.0
    assert calls["kwargs"]["end_time"] == 18.0


def test_scene_blueprint_rejects_too_short_window(monkeypatch):
    client = _client(monkeypatch)
    response = client.post(
        "/api/ai-films/scene-finder/blueprint",
        headers={"Authorization": "Bearer test"},
        json={
            "asset_id": "asset-123",
            "objective": "Analyze this shot.",
            "start_time": 10,
            "end_time": 12,
        },
    )
    assert response.status_code == 422
