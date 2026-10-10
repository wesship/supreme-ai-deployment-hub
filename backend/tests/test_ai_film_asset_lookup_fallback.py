import asyncio

import httpx

from backend.ai_films.ingestion import TwelveLabsIngestionRunner
from backend.ai_films.twelvelabs import TwelveLabsClient, TwelveLabsError


ENV = {
    "TWELVELABS_API_KEY": "test-api-key",
    "TWELVELABS_KNOWLEDGE_STORE_ID": "ks_test-film-store",
}


def test_twelvelabs_request_forwards_asset_filter_query_params():
    observed = {}

    def handler(request: httpx.Request) -> httpx.Response:
        observed["path"] = request.url.path
        observed["query"] = dict(request.url.params)
        return httpx.Response(200, json={"data": []})

    client = TwelveLabsClient(environ=ENV, transport=httpx.MockTransport(handler))
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


def test_asset_lookup_falls_back_to_filtered_list_after_direct_404():
    class FakeClient:
        api_key = "test-key"
        api_base_url = "https://api.twelvelabs.io/v1.3"
        knowledge_store_id = "ks_test"
        _transport = None

        def __init__(self):
            self.calls = []

        async def _request(self, method, path, *, payload=None, params=None):
            self.calls.append((method, path, params))
            if path == "/assets/asset_test":
                raise TwelveLabsError("TwelveLabs request failed with HTTP 404")
            assert path == "/assets"
            assert params == {"asset_ids": "asset_test", "page_limit": 1}
            return {"data": [{"_id": "asset_test", "status": "ready"}]}

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
    assert client.calls == [
        ("GET", "/assets/asset_test", None),
        ("GET", "/assets", {"asset_ids": "asset_test", "page_limit": 1}),
    ]


def test_asset_lookup_retries_when_both_paths_temporarily_miss():
    class FakeClient:
        api_key = "test-key"
        api_base_url = "https://api.twelvelabs.io/v1.3"
        knowledge_store_id = "ks_test"
        _transport = None

        def __init__(self):
            self.direct_calls = 0

        async def _request(self, method, path, *, payload=None, params=None):
            if path == "/assets/asset_test":
                self.direct_calls += 1
                if self.direct_calls == 1:
                    raise TwelveLabsError("TwelveLabs request failed with HTTP 404")
                return {"_id": "asset_test", "status": "ready"}
            assert path == "/assets"
            return {"data": []}

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
    assert client.direct_calls == 2
