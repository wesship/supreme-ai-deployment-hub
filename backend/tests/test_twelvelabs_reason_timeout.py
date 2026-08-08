from __future__ import annotations

import httpx
import pytest

from backend.ai_films.twelvelabs import TwelveLabsClient


@pytest.mark.asyncio
async def test_reason_uses_jockey_timeout_while_normal_requests_keep_default():
    seen = []

    async def handler(request: httpx.Request) -> httpx.Response:
        seen.append(request.url.path)
        return httpx.Response(200, json={"id": "ok"})

    client = TwelveLabsClient(
        environ={
            "TWELVELABS_API_KEY": "test",
            "TWELVELABS_KNOWLEDGE_STORE_ID": "ks_test",
            "TWELVELABS_REQUEST_TIMEOUT_SECONDS": "45",
            "TWELVELABS_JOCKEY_TIMEOUT_SECONDS": "180",
        },
        transport=httpx.MockTransport(handler),
    )

    assert client.request_timeout_seconds == 45.0
    assert client.jockey_timeout_seconds == 180.0
    await client.retrieve_knowledge_store()
    await client.reason("test")
    assert seen[-2:] == ["/v1.3/knowledge-stores/ks_test", "/v1.3/responses"]
