import asyncio
import json

import httpx

from backend.ai_films.ingestion import TwelveLabsIngestionRunner


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
