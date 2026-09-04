from __future__ import annotations

import json

import httpx
import pytest

from backend.hermes.model_council.integrations import (
    OpenAIChatCouncilProvider,
    research_evidence_verification_hook,
)
from backend.hermes.model_council.policy import ModelCouncilPolicy
from backend.hermes.model_council.schemas import CandidateResult, CandidateSpec, CouncilMode, CouncilRequest


async def _provider(spec: CandidateSpec, request: CouncilRequest) -> CandidateResult:
    return CandidateResult(provider=spec.provider, model=spec.model, content=f"answer:{spec.model}", success=True, latency_ms=10, cost_usd=0.01, groundedness=0.9, task_completion=0.9, consistency=0.9, tool_correctness=0.9, confidence=0.8, safety_passed=True)


@pytest.mark.asyncio
async def test_feature_flag_blocks_execution(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.delenv("HERMES_MODEL_COUNCIL_ENABLED", raising=False)
    monkeypatch.delenv("HERMES_MODEL_COUNCIL_SHADOW_MODE", raising=False)
    result = await ModelCouncilPolicy(_provider).run(CouncilRequest(prompt="test"))
    assert result.winner is None
    assert result.blocked_reason == "feature_disabled"


@pytest.mark.asyncio
async def test_shadow_mode_never_returns_authoritative_winner(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("HERMES_MODEL_COUNCIL_ENABLED", "true")
    monkeypatch.setenv("HERMES_MODEL_COUNCIL_SHADOW_MODE", "true")

    async def verify(candidate: CandidateResult, request: CouncilRequest) -> bool:
        return True

    request = CouncilRequest(prompt="test", mode=CouncilMode.SMART, candidates=[CandidateSpec(provider="p", model="m1")])
    result = await ModelCouncilPolicy(_provider, verification_hook=verify).run(request)
    assert result.winner is None
    assert result.verification_passed is True
    assert result.blocked_reason == "shadow_mode_non_authoritative"
    assert result.metadata["shadow_mode"] is True
    assert result.metadata["shadow_selected_model"] == "m1"


@pytest.mark.asyncio
async def test_smart_mode_caps_candidates_and_requires_verification(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("HERMES_MODEL_COUNCIL_ENABLED", "true")
    monkeypatch.delenv("HERMES_MODEL_COUNCIL_SHADOW_MODE", raising=False)

    async def verify(candidate: CandidateResult, request: CouncilRequest) -> bool:
        return candidate.model == "m2"

    request = CouncilRequest(prompt="test", mode=CouncilMode.SMART, candidates=[CandidateSpec(provider="p", model=f"m{i}") for i in range(5)])
    result = await ModelCouncilPolicy(_provider, verification_hook=verify).run(request)
    assert len(result.candidates) == 3
    assert result.winner is not None
    assert result.winner.model == "m2"
    assert result.verification_passed is True


@pytest.mark.asyncio
async def test_unsafe_candidate_cannot_win(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("HERMES_MODEL_COUNCIL_ENABLED", "true")
    monkeypatch.delenv("HERMES_MODEL_COUNCIL_SHADOW_MODE", raising=False)

    async def provider(spec: CandidateSpec, request: CouncilRequest) -> CandidateResult:
        result = await _provider(spec, request)
        if spec.model == "unsafe":
            result.safety_passed = False
            result.groundedness = 1.0
            result.task_completion = 1.0
        return result

    async def verify(candidate: CandidateResult, request: CouncilRequest) -> bool:
        return True

    request = CouncilRequest(prompt="test", mode=CouncilMode.SMART, candidates=[CandidateSpec(provider="p", model="unsafe"), CandidateSpec(provider="p", model="safe")])
    result = await ModelCouncilPolicy(provider, verification_hook=verify).run(request)
    assert result.winner is not None
    assert result.winner.model == "safe"


@pytest.mark.asyncio
async def test_openai_provider_uses_server_side_adapter_without_self_awarding_grounding() -> None:
    async def handler(request: httpx.Request) -> httpx.Response:
        assert request.headers["Authorization"] == "Bearer server-key"
        payload = json.loads(request.content)
        assert payload["model"] == "gpt-test"
        assert payload["messages"][-1]["content"] == "Explain Hermes"
        return httpx.Response(
            200,
            json={
                "choices": [{"message": {"content": "Hermes coordinates durable workflows."}, "finish_reason": "stop"}],
                "usage": {"prompt_tokens": 10, "completion_tokens": 6},
            },
            headers={"x-request-id": "req-test"},
        )

    transport = httpx.MockTransport(handler)
    provider = OpenAIChatCouncilProvider(
        api_key="server-key",
        client_factory=lambda: httpx.AsyncClient(transport=transport),
    )
    result = await provider(
        CandidateSpec(provider="openai", model="gpt-test"),
        CouncilRequest(prompt="Explain Hermes", require_verification=False),
    )
    assert result.success is True
    assert result.content == "Hermes coordinates durable workflows."
    assert result.groundedness == 0.0
    assert result.metadata["provider_request_id"] == "req-test"


@pytest.mark.asyncio
async def test_research_evidence_verifier_accepts_grounded_candidate() -> None:
    request = CouncilRequest(
        prompt="How does Hermes recover durable workflows?",
        context={
            "evidence": [
                {
                    "source": "web",
                    "title": "Hermes checkpoint recovery",
                    "snippet": "Hermes persists durable workflow checkpoints so execution can recover safely after interruption.",
                }
            ],
            "evidence_score_floor": 0.20,
            "evidence_overlap_floor": 0.05,
        },
    )
    candidate = CandidateResult(
        provider="openai",
        model="gpt-test",
        content="Hermes recovers durable workflow execution from persisted checkpoints after interruption.",
        success=True,
    )
    assert await research_evidence_verification_hook(candidate, request) is True
    assert candidate.groundedness > 0
    assert candidate.metadata["verification"]["evidence_count"] == 1


@pytest.mark.asyncio
async def test_research_evidence_verifier_fails_closed_without_evidence() -> None:
    candidate = CandidateResult(provider="openai", model="gpt-test", content="Unverified answer", success=True)
    request = CouncilRequest(prompt="test", context={})
    assert await research_evidence_verification_hook(candidate, request) is False
