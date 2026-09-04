from __future__ import annotations

import pytest

from backend.hermes.model_council.policy import ModelCouncilPolicy
from backend.hermes.model_council.schemas import CandidateResult, CandidateSpec, CouncilMode, CouncilRequest


async def _provider(spec: CandidateSpec, request: CouncilRequest) -> CandidateResult:
    return CandidateResult(provider=spec.provider, model=spec.model, content=f"answer:{spec.model}", success=True, latency_ms=10, cost_usd=0.01, groundedness=0.9, task_completion=0.9, consistency=0.9, tool_correctness=0.9, confidence=0.8, safety_passed=True)


@pytest.mark.asyncio
async def test_feature_flag_blocks_execution(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.delenv("HERMES_MODEL_COUNCIL_ENABLED", raising=False)
    result = await ModelCouncilPolicy(_provider).run(CouncilRequest(prompt="test"))
    assert result.winner is None
    assert result.blocked_reason == "feature_disabled"


@pytest.mark.asyncio
async def test_smart_mode_caps_candidates_and_requires_verification(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("HERMES_MODEL_COUNCIL_ENABLED", "true")

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
