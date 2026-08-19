"""Regression tests for shared Hermes infrastructure adapters."""
from __future__ import annotations

import hashlib
import hmac
from unittest.mock import AsyncMock, MagicMock, patch

import pytest

from backend.hermes.infrastructure import (
    HermesDispatchClient,
    HermesInfrastructureConfig,
    SupabaseRestClient,
    canonical_json,
    sign_payload,
)


def test_config_from_env_and_urls(monkeypatch):
    monkeypatch.setenv("SUPABASE_URL", "https://example.supabase.co/")
    monkeypatch.setenv("SUPABASE_SERVICE_ROLE_KEY", "service-key")
    monkeypatch.setenv("HERMES_WEBHOOK_SECRET", "webhook-secret")
    monkeypatch.setenv("HERMES_INTERNAL_API_KEY", "internal-key")
    config = HermesInfrastructureConfig.from_env()
    assert config.supabase_url == "https://example.supabase.co"
    assert config.supabase_configured is True
    assert config.dispatch_configured is True
    assert config.rest_url("hermes_tasks").endswith("/rest/v1/hermes_tasks")
    assert config.enqueue_url.endswith("/functions/v1/enqueue-task")


def test_canonical_json_and_signature_are_deterministic():
    first = canonical_json({"z": 1, "a": {"b": 2}})
    second = canonical_json({"a": {"b": 2}, "z": 1})
    assert first == second == '{"a":{"b":2},"z":1}'
    expected = hmac.new(b"secret", first.encode(), hashlib.sha256).hexdigest()
    assert sign_payload(first, "secret") == expected
    with pytest.raises(ValueError, match="must not be empty"):
        sign_payload(first, "")


def test_supabase_headers_combine_preferences():
    client = SupabaseRestClient(
        HermesInfrastructureConfig(
            supabase_url="https://example.supabase.co",
            service_role_key="key",
        )
    )
    headers = client.headers(return_representation=True, count_exact=True)
    assert headers["apikey"] == "key"
    assert headers["Authorization"] == "Bearer key"
    assert headers["Prefer"] == "return=representation,count=exact"


@pytest.mark.asyncio
async def test_unconfigured_supabase_degrades_without_network():
    client = SupabaseRestClient(HermesInfrastructureConfig())
    assert await client.get("hermes_tasks", {}) == []
    assert await client.post("hermes_tasks", {"title": "x"}) == {}
    assert await client.rpc("hermes_claim_task", {"p_worker_id": "worker-a"}) is None
    assert await client.patch("hermes_tasks", "id", {"status": "PENDING"}) == {}
    assert await client.count("hermes_tasks") == -1


@pytest.mark.asyncio
async def test_supabase_normalizes_list_and_count_responses():
    config = HermesInfrastructureConfig(
        supabase_url="https://example.supabase.co",
        service_role_key="key",
    )
    client = SupabaseRestClient(config)
    post_response = MagicMock()
    post_response.status_code = 201
    post_response.content = b'[{"id":"1"}]'
    post_response.json.return_value = [{"id": "1"}]
    post_response.raise_for_status.return_value = None

    rpc_response = MagicMock()
    rpc_response.status_code = 200
    rpc_response.content = b'[{"task_id":"1"}]'
    rpc_response.json.return_value = [{"task_id": "1"}]
    rpc_response.raise_for_status.return_value = None

    count_response = MagicMock()
    count_response.status_code = 200
    count_response.headers = {"content-range": "0-9/42"}
    count_response.json.return_value = []

    mock_client = AsyncMock()
    mock_client.__aenter__ = AsyncMock(return_value=mock_client)
    mock_client.__aexit__ = AsyncMock(return_value=False)
    mock_client.post = AsyncMock(side_effect=[post_response, rpc_response])
    mock_client.get = AsyncMock(return_value=count_response)

    with patch("backend.hermes.infrastructure.supabase_client.httpx.AsyncClient", return_value=mock_client):
        assert await client.post("hermes_tasks", {"title": "x"}) == {"id": "1"}
        assert await client.rpc("hermes_claim_task", {"p_worker_id": "worker-a"}) == [{"task_id": "1"}]
        assert await client.count("hermes_tasks") == 42

    rpc_call = mock_client.post.await_args_list[1]
    assert rpc_call.args[0] == "https://example.supabase.co/rest/v1/rpc/hermes_claim_task"
    assert rpc_call.kwargs["json"] == {"p_worker_id": "worker-a"}

@pytest.mark.asyncio
async def test_dispatch_signs_exact_transmitted_body_and_optional_auth():
    config = HermesInfrastructureConfig(
        supabase_url="https://example.supabase.co",
        service_role_key="service-key",
        webhook_secret="secret",
    )
    dispatcher = HermesDispatchClient(config)
    response = MagicMock()
    response.json.return_value = {"ok": True}
    response.raise_for_status.return_value = None
    mock_client = AsyncMock()
    mock_client.__aenter__ = AsyncMock(return_value=mock_client)
    mock_client.__aexit__ = AsyncMock(return_value=False)
    mock_client.post = AsyncMock(return_value=response)

    payload = {"task_id": "1", "agent": "TARS", "input": {}}
    with patch("backend.hermes.infrastructure.dispatch.httpx.AsyncClient", return_value=mock_client):
        result = await dispatcher.enqueue(
            payload,
            include_service_authorization=True,
            signature_header="X-Hermes-Signature",
        )

    assert result == {"ok": True}
    kwargs = mock_client.post.await_args.kwargs
    body = kwargs["content"]
    assert kwargs["headers"]["X-Hermes-Signature"] == sign_payload(body, "secret")
    assert kwargs["headers"]["Authorization"] == "Bearer service-key"


@pytest.mark.asyncio
async def test_unconfigured_dispatch_degrades_without_network():
    dispatcher = HermesDispatchClient(HermesInfrastructureConfig())
    assert await dispatcher.enqueue({"task_id": "1"}) == {
        "status": "skipped",
        "reason": "not_configured",
    }
