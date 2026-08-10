import httpx
import pytest

from backend.ai_films import commerce_handoff_worker as worker


@pytest.mark.asyncio
async def test_fetch_pollo_result_uses_authoritative_status_endpoint():
    async def handler(request: httpx.Request) -> httpx.Response:
        assert request.url.path == "/api/platform/generation/task-1/status"
        assert request.headers["x-api-key"] == "test-key"
        return httpx.Response(
            200,
            json={
                "data": {
                    "generations": [
                        {
                            "status": "succeed",
                            "url": "https://cdn.example.test/render.mp4",
                        }
                    ]
                }
            },
        )

    result = await worker.fetch_pollo_result(
        "task-1",
        {
            "POLLO_API_KEY": "test-key",
            "POLLO_API_BASE_URL": "https://pollo.ai/api/platform",
        },
        transport=httpx.MockTransport(handler),
    )

    assert result["generations"][0]["status"] == "succeed"


def test_task_generations_waits_for_downloadable_result():
    with pytest.raises(worker.CommerceHandoffPending):
        worker._task_generations(
            {"generations": [{"status": "processing", "url": ""}]}
        )


def test_task_generations_rejects_non_https_media():
    with pytest.raises(worker.CommerceHandoffError):
        worker._task_generations(
            {
                "generations": [
                    {"status": "succeed", "url": "http://example.test/render.mp4"}
                ]
            }
        )


def test_task_generations_rejects_unknown_terminal_status():
    with pytest.raises(worker.CommerceHandoffError):
        worker._task_generations(
            {
                "generations": [
                    {"status": "mystery", "url": "https://example.test/render.mp4"}
                ]
            }
        )


@pytest.mark.asyncio
async def test_process_handoff_is_restart_safe_and_completes(monkeypatch):
    calls = []

    class FakeDb:
        async def _request(
            self,
            method,
            table,
            *,
            params=None,
            payload=None,
            representation=False,
        ):
            calls.append(
                {
                    "method": method,
                    "table": table,
                    "params": params,
                    "payload": payload,
                    "representation": representation,
                }
            )
            return []

    async def fake_fetch(task_id, environ):
        assert task_id == "task-1"
        return {
            "generations": [
                {"status": "succeed", "url": "https://cdn.example.test/one.mp4"},
                {"status": "succeed", "url": "https://cdn.example.test/two.mp4"},
            ]
        }

    ingested_sources = []

    class FakeClient:
        knowledge_store_id = "ks-test"

    class FakeRunner:
        def __init__(self, client):
            assert client.knowledge_store_id == "ks-test"

        async def ingest_entry(self, entry, *, wait_for_item=False):
            assert wait_for_item is False
            ingested_sources.append(entry["source_id"])
            return {
                "source_id": entry["source_id"],
                "status": "queued",
                "twelvelabs_asset_id": "asset-2",
                "twelvelabs_item_id": "item-2",
            }

    monkeypatch.setattr(worker, "fetch_pollo_result", fake_fetch)
    monkeypatch.setattr(worker, "TwelveLabsClient", lambda _source: FakeClient())
    monkeypatch.setattr(worker, "TwelveLabsIngestionRunner", FakeRunner)

    result = await worker.process_commerce_handoff(
        {
            "id": "job-1",
            "task_id": "task-1",
            "output": {},
            "handoff_payload": {
                "results": [
                    {
                        "source_id": "task-1:1",
                        "status": "queued",
                        "twelvelabs_asset_id": "asset-1",
                        "twelvelabs_item_id": "item-1",
                    }
                ]
            },
        },
        FakeDb(),
        {},
    )

    assert ingested_sources == ["task-1:2"]
    assert result["state"] == "completed"
    assert result["knowledge_store_id"] == "ks-test"
    final = calls[-1]["payload"]
    assert final["handoff_status"] == "completed"
    assert len(final["handoff_payload"]["results"]) == 2
