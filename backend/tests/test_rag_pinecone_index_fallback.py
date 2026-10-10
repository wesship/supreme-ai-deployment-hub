"""Tests for Pinecone index discovery, runtime dimension, and SDK fallback."""

from types import SimpleNamespace
from unittest.mock import MagicMock, patch

import pytest
from fastapi import HTTPException

from backend.app.routers.rag import (
    _describe_pinecone_index,
    _pinecone_delete,
    _pinecone_query,
    _pinecone_runtime_config,
    _pinecone_upsert,
)


@pytest.fixture(autouse=True)
def clear_pinecone_description_cache():
    _describe_pinecone_index.cache_clear()
    yield
    _describe_pinecone_index.cache_clear()


@pytest.mark.asyncio
async def test_upsert_uses_sdk_index_when_host_is_missing():
    index = MagicMock()

    with patch("backend.app.routers.rag._pinecone_sdk_index", return_value=index):
        await _pinecone_upsert(
            [{"id": "one", "values": [0.1, 0.2], "metadata": {"filename": "one.txt"}}],
            "",
            "pinecone-key",
            "documents",
            "devonn-rag",
        )

    index.upsert.assert_called_once_with(
        vectors=[{"id": "one", "values": [0.1, 0.2], "metadata": {"filename": "one.txt"}}],
        namespace="documents",
    )


@pytest.mark.asyncio
async def test_query_uses_sdk_index_when_host_is_missing():
    index = MagicMock()
    result = MagicMock()
    result.to_dict.return_value = {
        "matches": [{"id": "one", "score": 0.99, "metadata": {"text": "fixture"}}]
    }
    index.query.return_value = result

    with patch("backend.app.routers.rag._pinecone_sdk_index", return_value=index):
        matches = await _pinecone_query(
            [0.1, 0.2],
            "",
            "pinecone-key",
            "documents",
            5,
            "devonn-rag",
        )

    assert matches[0]["id"] == "one"
    index.query.assert_called_once_with(
        vector=[0.1, 0.2],
        namespace="documents",
        top_k=5,
        include_metadata=True,
    )


@pytest.mark.asyncio
async def test_delete_uses_sdk_index_when_host_is_missing():
    index = MagicMock()

    with patch("backend.app.routers.rag._pinecone_sdk_index", return_value=index):
        await _pinecone_delete(
            "fixture.txt",
            "",
            "pinecone-key",
            "documents",
            "devonn-rag",
        )

    index.delete.assert_called_once_with(
        filter={"filename": {"$eq": "fixture.txt"}},
        namespace="documents",
    )


@pytest.mark.asyncio
async def test_runtime_config_prefers_discovered_host_and_dimension():
    settings = SimpleNamespace(
        pinecone_api_key="pinecone-key",
        pinecone_index_name="devonn-rag",
        pinecone_host="stale-host.example",
        pinecone_dimension=768,
    )

    with patch(
        "backend.app.routers.rag._describe_pinecone_index",
        return_value={"host": "live-host.svc.pinecone.io", "dimension": 1536},
    ):
        host, dimension = await _pinecone_runtime_config(settings)

    assert host == "live-host.svc.pinecone.io"
    assert dimension == 1536


@pytest.mark.asyncio
async def test_runtime_config_falls_back_to_explicit_host_when_description_fails():
    settings = SimpleNamespace(
        pinecone_api_key="pinecone-key",
        pinecone_index_name="devonn-rag",
        pinecone_host="configured-host.svc.pinecone.io",
        pinecone_dimension=768,
    )

    with patch(
        "backend.app.routers.rag._describe_pinecone_index",
        side_effect=HTTPException(status_code=502, detail="control plane unavailable"),
    ):
        host, dimension = await _pinecone_runtime_config(settings)

    assert host == "configured-host.svc.pinecone.io"
    assert dimension == 768


@pytest.mark.asyncio
async def test_runtime_config_requires_discovery_when_no_host_is_configured():
    settings = SimpleNamespace(
        pinecone_api_key="pinecone-key",
        pinecone_index_name="devonn-rag",
        pinecone_host="",
        pinecone_dimension=768,
    )

    with patch(
        "backend.app.routers.rag._describe_pinecone_index",
        side_effect=HTTPException(status_code=502, detail="control plane unavailable"),
    ):
        with pytest.raises(HTTPException) as exc_info:
            await _pinecone_runtime_config(settings)

    assert exc_info.value.status_code == 502
