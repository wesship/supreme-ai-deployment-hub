import asyncio
import json

import httpx
import pytest

from backend.ai_films.twelvelabs_analyze import TwelveLabsAnalyzeClient
from backend.ai_films.index_router import AnalyzeAssetRequest


def test_analyze_asset_reuses_existing_asset_id():
    observed = {}

    def handler(request: httpx.Request) -> httpx.Response:
        observed["method"] = request.method
        observed["path"] = request.url.path
        observed["payload"] = json.loads(request.content.decode())
        assert request.headers.get("x-api-key") == "test-key"
        return httpx.Response(
            200,
            json={
                "id": "analysis-1",
                "data": "Characters: one man. Setting: dark industrial engine room.",
                "usage": {"input_tokens": 100, "output_tokens": 60},
            },
        )

    client = TwelveLabsAnalyzeClient(
        environ={
            "TWELVELABS_API_KEY": "test-key",
            "TWELVELABS_API_BASE_URL": "https://api.twelvelabs.io/v1.3",
        },
        transport=httpx.MockTransport(handler),
    )
    result = asyncio.run(
        client.analyze_asset(
            "asset-123",
            "Analyze characters, setting, camera movement, lighting and continuity.",
            start_time=4.0,
            end_time=12.0,
        )
    )

    assert result["id"] == "analysis-1"
    assert observed["method"] == "POST"
    assert observed["path"] == "/v1.3/analyze"
    assert observed["payload"]["model_name"] == "pegasus1.5"
    assert observed["payload"]["video"] == {"type": "asset_id", "asset_id": "asset-123"}
    assert observed["payload"]["stream"] is False
    assert observed["payload"]["start_time"] == 4.0
    assert observed["payload"]["end_time"] == 12.0


def test_analyze_request_rejects_short_clip_window():
    with pytest.raises(ValueError):
        AnalyzeAssetRequest(
            asset_id="asset-123",
            prompt="Analyze continuity.",
            start_time=5.0,
            end_time=7.0,
        )


def test_analyze_request_rejects_pegasus12_clip_window():
    with pytest.raises(ValueError):
        AnalyzeAssetRequest(
            asset_id="asset-123",
            prompt="Analyze continuity.",
            model_name="pegasus1.2",
            start_time=0.0,
            end_time=8.0,
        )
