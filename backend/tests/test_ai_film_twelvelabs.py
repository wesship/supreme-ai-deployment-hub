import asyncio
import json

import httpx
import pytest

from backend.ai_films.providers import PROVIDER_SPECS, provider_health
from backend.ai_films.twelvelabs import (
    DEFAULT_API_BASE_URL,
    TwelveLabsClient,
    TwelveLabsConfigurationError,
    TwelveLabsError,
)


ENV = {
    "TWELVELABS_API_KEY": "test-api-key",
    "TWELVELABS_KNOWLEDGE_STORE_ID": "ks_test-film-store",
}


def test_provider_registry_includes_twelvelabs_video_intelligence():
    spec = next(
        item
        for item in PROVIDER_SPECS
        if item.capability == "video_intelligence" and item.provider == "twelvelabs"
    )
    assert spec.required_env == (
        "TWELVELABS_API_KEY",
        "TWELVELABS_KNOWLEDGE_STORE_ID",
    )

    health = provider_health(ENV)
    assert health["capabilities"]["video_intelligence"] is True
    assert "test-api-key" not in repr(health)


def test_twelvelabs_requires_key_and_store_id():
    with pytest.raises(TwelveLabsConfigurationError) as exc_info:
        TwelveLabsClient(environ={"TWELVELABS_API_KEY": "only-a-key"})
    assert "TWELVELABS_KNOWLEDGE_STORE_ID" in str(exc_info.value)


def test_twelvelabs_search_uses_v13_knowledge_store_endpoint():
    observed = {}

    def handler(request: httpx.Request) -> httpx.Response:
        observed["method"] = request.method
        observed["path"] = request.url.path
        observed["api_key"] = request.headers["x-api-key"]
        observed["payload"] = json.loads(request.content)
        return httpx.Response(
            200,
            json={
                "data": [
                    {
                        "asset_type": "video",
                        "item_id": "ksi_clip",
                        "matches": [{"start_sec": 12.5, "end_sec": 18.25}],
                        "rank": 1,
                    }
                ],
                "effective_search_options": {
                    "video": {"modalities": ["visual", "audio"]}
                },
            },
        )

    client = TwelveLabsClient(
        environ=ENV,
        transport=httpx.MockTransport(handler),
    )
    result = asyncio.run(
        client.search(
            "Find every shot where Legend is not wearing a plain white T-shirt",
            page_size=7,
        )
    )

    assert client.api_base_url == DEFAULT_API_BASE_URL
    assert observed["method"] == "POST"
    assert observed["path"] == "/v1.3/knowledge-stores/ks_test-film-store/search"
    assert observed["api_key"] == "test-api-key"
    assert observed["payload"]["query"]["text"].startswith("Find every shot")
    assert observed["payload"]["search_options"]["video"]["modalities"] == [
        "visual",
        "audio",
    ]
    assert observed["payload"]["page_size"] == 7
    assert result["data"][0]["item_id"] == "ksi_clip"


def test_twelvelabs_request_forwards_query_parameters():
    observed = {}

    def handler(request: httpx.Request) -> httpx.Response:
        observed["path"] = request.url.path
        observed["query"] = dict(request.url.params)
        return httpx.Response(200, json={"data": []})

    client = TwelveLabsClient(
        environ=ENV,
        transport=httpx.MockTransport(handler),
    )
    result = asyncio.run(
        client._request(
            "GET",
            "/assets",
            params={"asset_ids": "asset_test", "page_limit": 1},
        )
    )

    assert observed["path"] == "/v1.3/assets"
    assert observed["query"] == {"asset_ids": "asset_test", "page_limit": "1"}
    assert result == {"data": []}


def test_twelvelabs_reason_uses_jockey_responses_endpoint():
    observed = {}

    def handler(request: httpx.Request) -> httpx.Response:
        observed["path"] = request.url.path
        observed["payload"] = json.loads(request.content)
        return httpx.Response(
            200,
            json={
                "id": "resp_test",
                "type": "response",
                "status": "completed",
                "session_id": "sess_test",
                "knowledge_store_id": "ks_test-film-store",
                "output": [],
            },
        )

    client = TwelveLabsClient(
        environ=ENV,
        transport=httpx.MockTransport(handler),
    )
    result = asyncio.run(
        client.reason(
            "Audit Act II for continuity violations.",
            session_id="sess_previous",
            include_intermediate=True,
        )
    )

    assert observed["path"] == "/v1.3/responses"
    assert observed["payload"]["knowledge_store_id"] == "ks_test-film-store"
    assert observed["payload"]["session_id"] == "sess_previous"
    assert observed["payload"]["stream"] is False
    assert observed["payload"]["include"] == ["intermediate_outputs"]
    assert observed["payload"]["input"][0]["role"] == "user"
    assert "D3VONN.IO AI Film continuity" in observed["payload"]["instructions"]
    assert result["id"] == "resp_test"


def test_twelvelabs_error_does_not_echo_vendor_body():
    leaked_value = "never-echo-this-provider-detail"

    def handler(_: httpx.Request) -> httpx.Response:
        return httpx.Response(401, json={"detail": leaked_value})

    client = TwelveLabsClient(
        environ=ENV,
        transport=httpx.MockTransport(handler),
    )

    with pytest.raises(TwelveLabsError) as exc_info:
        asyncio.run(client.retrieve_knowledge_store())

    assert "HTTP 401" in str(exc_info.value)
    assert leaked_value not in str(exc_info.value)
