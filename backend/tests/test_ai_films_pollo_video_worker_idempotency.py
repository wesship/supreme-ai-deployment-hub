import pytest

from backend.ai_films import pollo_video_worker as worker


class FakeDB:
    def __init__(self):
        self.updates = []

    async def update_job(self, job_id, payload):
        self.updates.append((job_id, payload))

    async def upload_master(self, path, object_path):
        return {"sha256": "abc123", "storage_object_path": object_path}

    async def _request(self, method, table, payload=None, representation=False, **kwargs):
        if method == "POST" and table == "ai_film_assets":
            return [{"id": "asset-1"}]
        return []


class FakeResponse:
    status_code = 200
    content = b"video-bytes"


class FakeHTTP:
    def __init__(self, *args, **kwargs):
        pass

    async def __aenter__(self):
        return self

    async def __aexit__(self, exc_type, exc, tb):
        return False

    async def get(self, url):
        return FakeResponse()


def make_job(output=None):
    return {
        "id": "job-1",
        "project_id": "project-1",
        "owner_id": "owner-1",
        "progress": 0,
        "output": output or {},
        "input": {
            "shot_id": "shot-1",
            "generation_packet": {
                "shot_id": "shot-1",
                "generation_prompt": "cinematic test",
                "duration_target_seconds": 5,
            },
        },
    }


@pytest.mark.asyncio
async def test_recovered_job_resumes_existing_task_without_create(monkeypatch):
    calls = {"create": 0, "wait": 0}

    class FakeClient:
        model = "pollo-v2-5"

        def __init__(self, environ=None):
            pass

        async def create(self, *args, **kwargs):
            calls["create"] += 1
            raise AssertionError("create must not be called for recovered jobs")

        async def wait(self, task_id):
            calls["wait"] += 1
            assert task_id == "existing-task"
            return {"urls": ["https://example.com/video.mp4"]}

    monkeypatch.setattr(worker, "PolloVideoClient", FakeClient)
    monkeypatch.setattr(worker.httpx, "AsyncClient", FakeHTTP)

    db = FakeDB()
    result = await worker.process_pollo_video_job(
        make_job({
            "provider_task_id": "existing-task",
            "provider_model": "pollo-v2-5",
            "provider_status": "waiting",
        }),
        db,
        {"POLLO_API_KEY": "test"},
    )

    assert calls == {"create": 0, "wait": 1}
    assert result["provider_task_id"] == "existing-task"
    assert result["generated_asset_id"] == "asset-1"
    assert any(
        payload.get("output", {}).get("resume_state") == "resumed_existing_provider_task"
        for _, payload in db.updates
    )


@pytest.mark.asyncio
async def test_fresh_job_creates_exactly_once(monkeypatch):
    calls = {"create": 0, "wait": 0}

    class FakeClient:
        model = "pollo-v2-5"

        def __init__(self, environ=None):
            pass

        async def create(self, *args, **kwargs):
            calls["create"] += 1
            return {"taskId": "new-task", "status": "waiting"}

        async def wait(self, task_id):
            calls["wait"] += 1
            assert task_id == "new-task"
            return {"urls": ["https://example.com/video.mp4"]}

    monkeypatch.setattr(worker, "PolloVideoClient", FakeClient)
    monkeypatch.setattr(worker.httpx, "AsyncClient", FakeHTTP)

    db = FakeDB()
    result = await worker.process_pollo_video_job(
        make_job(),
        db,
        {"POLLO_API_KEY": "test"},
    )

    assert calls == {"create": 1, "wait": 1}
    assert result["provider_task_id"] == "new-task"
    assert result["generated_asset_id"] == "asset-1"
