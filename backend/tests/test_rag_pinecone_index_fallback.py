"""Tests for Pinecone index-name discovery when no explicit host is configured."""

from unittest.mock import MagicMock, patch

import pytest

from backend.app.routers.rag import (
    _pinecone_delete,
    _pinecone_query,
    _pinecone_upsert,
)


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
