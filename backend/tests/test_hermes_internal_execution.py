"""Tests for the private Hermes worker-to-API execution boundary."""
from __future__ import annotations

from types import SimpleNamespace
from unittest.mock import AsyncMock, MagicMock, patch

import pytest
from fastapi import HTTPException

from backend.hermes.infrastructure import HermesInfrastructureConfig
from backend.occ_operator import hermes_router as router


def test_internal_execution_key_fails_closed(monkeypatch):
    monkeypatch.setattr(
        router,
        "_CONFIG",
        HermesInfrastructureConfig(internal_api_key="internal-key"),
    )
    with pytest.raises(HTTPException) as exc:
        router._require_internal_execution_key("wrong")
    assert exc.value.status_code == 401

    router._require_internal_execution_key("internal-key")


@pytest.mark.asyncio
async def test_internal_tars_execution_uses_server_side_openai(monkeypatch):
    monkeypatch.setattr(
        router,
        "_CONFIG",
        HermesInfrastructureConfig(internal_api_key="internal-key"),
    )
    monkeypatch.setattr(
        router,
        "get_settings",
        lambda: SimpleNamespace(
            openai_api_key="server-side-key",
            openai_default_model="gpt-4.1-mini",
            openai_max_tokens=2048,
        ),
    )

    response = MagicMock()
    response.status_code = 200
    response.json.return_value = {
        "choices": [{"message": {"content": "acknowledged"}}]
    }
    client = AsyncMock()
    client.__aenter__ = AsyncMock(return_value=client)
    client.__aexit__ = AsyncMock(return_value=False)
    client.post = AsyncMock(return_value=response)

    body = router.InternalExecuteRequest(
        task_id="task-1",
        agent_name="TARS",
        input_data={"instruction": "Return a short acknowledgement."},
        idempotency_key="hermes-task:task-1",
    )
    with patch("backend.occ_operator.hermes_router.httpx.AsyncClient", return_value=client):
        result = await router.execute_internal_agent(body, None)

    assert result["status"] == "completed"
    assert result["task_id"] == "task-1"
    assert result["output"]["text"] == "acknowledged"
    call = client.post.await_args
    assert call.args[0] == router.OPENAI_CHAT_URL
    assert call.kwargs["headers"]["Authorization"] == "Bearer server-side-key"
    assert call.kwargs["json"]["stream"] is False
    assert "enqueue-task" not in call.args[0]


@pytest.mark.asyncio
async def test_internal_execution_rejects_unknown_agent(monkeypatch):
    monkeypatch.setattr(
        router,
        "_CONFIG",
        HermesInfrastructureConfig(internal_api_key="internal-key"),
    )
    body = router.InternalExecuteRequest(
        task_id="task-1",
        agent_name="GUARDIAN",
        input_data={},
    )
    with pytest.raises(HTTPException) as exc:
        await router.execute_internal_agent(body, None)
    assert exc.value.status_code == 422
