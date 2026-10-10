import asyncio

import httpx

from backend.ai_films.twelvelabs_index import (
    DEFAULT_AI_FILMS_INDEX_ID,
    TwelveLabsIndexClient,
)


def test_retrieve_index_uses_canonical_index_id():
    def handler(request: httpx.Request) -> httpx.Response:
        assert request.method == "GET"
        assert request.url.path == f"/v1.3/indexes/{DEFAULT_AI_FILMS_INDEX_ID}"
        return httpx.Response(
            200,
            json={
                "_id": DEFAULT_AI_FILMS_INDEX_ID,
                "index_name": "My Index (Default)",
                "video_count": 4,
            },
        )

    client = TwelveLabsIndexClient(
        environ={
            "TWELVELABS_API_KEY": "test-key",
            "TWELVELABS_API_BASE_URL": "https://api.twelvelabs.io/v1.3",
        },
        transport=httpx.MockTransport(handler),
    )
    result = asyncio.run(client.retrieve_index())
    assert result["_id"] == DEFAULT_AI_FILMS_INDEX_ID


def test_search_uses_multipart_and_all_modalities():
    observed = {}

    def handler(request: httpx.Request) -> httpx.Response:
        observed["content_type"] = request.headers.get("content-type", "")
        observed["body"] = request.content
        assert request.method == "POST"
        assert request.url.path == "/v1.3/search"
        return httpx.Response(
            200,
            json={
                "data": [{"video_id": "video-1", "start": 1.0, "end": 3.0, "rank": 1}],
                "search_pool": {"index_id": DEFAULT_AI_FILMS_INDEX_ID},
            },
        )

    client = TwelveLabsIndexClient(
        environ={
            "TWELVELABS_API_KEY": "test-key",
            "TWELVELABS_API_BASE_URL": "https://api.twelvelabs.io/v1.3",
        },
        transport=httpx.MockTransport(handler),
    )
    result = asyncio.run(client.search("woman surrounded by blue futuristic energy"))

    assert result["search_pool"]["index_id"] == DEFAULT_AI_FILMS_INDEX_ID
    assert observed["content_type"].startswith("multipart/form-data; boundary=")
    body = observed["body"]
    assert b'name="query_text"' in body
    assert b"woman surrounded by blue futuristic energy" in body
    assert b'name="index_id"' in body
    assert DEFAULT_AI_FILMS_INDEX_ID.encode() in body
    assert b"visual" in body
    assert b"audio" in body
    assert b"transcription" in body
    assert b"lexical" in body
    assert b"semantic" in body
