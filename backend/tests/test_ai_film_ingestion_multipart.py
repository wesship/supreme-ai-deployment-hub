import asyncio
import json

import httpx

from backend.ai_films.ingestion import TwelveLabsIngestionRunner
from backend.ai_films.twelvelabs import TwelveLabsError


def test_url_asset_creation_uses_multipart_form_data():
    observed = {}

    def handler(request: httpx.Request) -> httpx.Response:
        observed["content_type"] = request.headers.get("content-type", "")
        observed["body"] = request.content
        return httpx.Response(
            201,
            json={
                "_id": "asset_test",
                "method": "url",
                "status": "processing",
                "filename": "clip.mp4",
                "file_type": "video/mp4",
            },
        )

    class FakeClient:
        api_key = "test-key"
        api_base_url = "https://api.twelvelabs.io/v1.3"
        knowledge_store_id = "ks_test"
        _transport = httpx.MockTransport(handler)

    runner = TwelveLabsIngestionRunner(client=FakeClient())
    result = asyncio.run(
        runner._create_asset(
            url=(
                "https://oss1.movieflow.ai/portrait/clip.mp4"
                "?x-oss-process=video/snapshot,t_0,f_jpg"
            ),
            filename="clip.mp4",
            user_metadata={"source_type": "movieflow"},
        )
    )

    assert result["_id"] == "asset_test"
    assert observed["content_type"].startswith("multipart/form-data; boundary=")
    body = observed["body"]
    assert b'name="method"' in body and b"url" in body
    assert b'name="url"' in body
    assert b"https://oss1.movieflow.ai/portrait/clip.mp4" in body
    assert b"x-oss-process" not in body
    assert json.dumps({"source_type": "movieflow"}, separators=(",", ":")).encode() in body


def test_asset_poll_retries_transient_404_until_ready():
    class FakeClient:
        api_key = "test-key"
        api_base_url = "https://api.twelvelabs.io/v1.3"
        knowledge_store_id = "ks_test"
        _transport = None

        def __init__(self):
            self.calls = 0

        async def _request(self, method, path, *, payload=None):
            self.calls += 1
            if self.calls == 1:
                raise TwelveLabsError("TwelveLabs request failed with HTTP 404")
            return {"_id": "asset_test", "status": "ready"}

    client = FakeClient()
    runner = TwelveLabsIngestionRunner(client=client)
    result = asyncio.run(
        runner._wait_for_asset(
            "asset_test",
            timeout_seconds=1.0,
            poll_interval_seconds=0.001,
        )
    )

    assert result["status"] == "ready"
    assert client.calls == 2


def test_item_poll_retries_transient_404_until_ready():
    class FakeClient:
        api_key = "test-key"
        api_base_url = "https://api.twelvelabs.io/v1.3"
        knowledge_store_id = "ks_test"
        _transport = None

        def __init__(self):
            self.calls = 0

        async def _request(self, method, path, *, payload=None):
            self.calls += 1
            if self.calls == 1:
                raise TwelveLabsError("TwelveLabs request failed with HTTP 404")
            return {"_id": "item_test", "status": "ready"}

    client = FakeClient()
    runner = TwelveLabsIngestionRunner(client=client)
    result = asyncio.run(
        runner._wait_for_item(
            "item_test",
            timeout_seconds=1.0,
            poll_interval_seconds=0.001,
        )
    )

    assert result["status"] == "ready"
    assert client.calls == 2
