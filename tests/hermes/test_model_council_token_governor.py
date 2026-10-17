from __future__ import annotations

import json

import httpx
import pytest

from backend.hermes.model_council.integrations import OpenAIChatCouncilProvider
from backend.hermes.model_council.schemas import CandidateSpec, CouncilRequest


@pytest.mark.asyncio
async def test_hermes_provider_enforces_agent_token_cap_and_records_decision() -> None:
    captured: dict = {}

    async def handler(request: httpx.Request) -> httpx.Response:
        payload = json.loads(request.content)
        captured.update(payload)
        return httpx.Response(
            200,
            json={
                "choices": [
                    {
                        "message": {"content": "governed answer"},
                        "finish_reason": "stop",
                    }
                ],
                "usage": {"prompt_tokens": 12, "completion_tokens": 20},
            },
        )

    transport = httpx.MockTransport(handler)
    provider = OpenAIChatCouncilProvider(
        api_key="server-key",
        client_factory=lambda: httpx.AsyncClient(transport=transport),
    )
    spec = CandidateSpec(
        provider="openai",
        model="gpt-test",
        metadata={"max_tokens": 99_999},
    )

    result = await provider(
        spec,
        CouncilRequest(prompt="Plan this workflow", require_verification=False),
    )

    assert captured["max_tokens"] == 8_192
    assert result.metadata["token_governor"]["policy"] == "agent"
    assert result.metadata["token_governor"]["requested_output_tokens"] == 99_999
    assert result.metadata["token_governor"]["allowed_output_tokens"] == 8_192
    assert result.metadata["usage"]["completion_tokens"] == 20
