"""Tests for authoritative Pinecone host and dimension discovery."""

from types import SimpleNamespace
from unittest.mock import patch

import pytest
from fastapi import HTTPException

from backend.app.routers.rag import _pinecone_runtime_config


@pytest.mark.asyncio
async def test_runtime_config_uses_described_host_and_dimension():
    settings = SimpleNamespace(
        pinecone_api_key="pinecone-key",
        pinecone_index_name="devonn-rag",
        pinecone_host="",
        pinecone_dimension=768,
    )

    with patch(
        "backend.app.routers.rag._describe_pinecone_index",
        return_value={"host": "live-index.svc.pinecone.io", "dimension": 1536},
    ):
        host, dimension = await _pinecone_runtime_config(settings)

    assert host == "live-index.svc.pinecone.io"
    assert dimension == 1536


@pytest.mark.asyncio
async def test_runtime_description_overrides_stale_configured_dimension():
    settings = SimpleNamespace(
        pinecone_api_key="pinecone-key",
        pinecone_index_name="devonn-rag",
        pinecone_host="stale-host.svc.pinecone.io",
        pinecone_dimension=768,
    )

    with patch(
        "backend.app.routers.rag._describe_pinecone_index",
        return_value={"host": "authoritative-host.svc.pinecone.io", "dimension": 1536},
    ):
        host, dimension = await _pinecone_runtime_config(settings)

    assert host == "authoritative-host.svc.pinecone.io"
    assert dimension == 1536


@pytest.mark.asyncio
async def test_configured_host_and_dimension_are_fallback_when_description_fails():
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
