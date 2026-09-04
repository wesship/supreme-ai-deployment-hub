from __future__ import annotations

import os

from .evaluator import CouncilEvaluator
from .executor import CouncilExecutor, ProviderCall
from .schemas import CouncilMode, CouncilRequest, CouncilResult
from .verifier import CouncilVerifier, VerificationHook


def model_council_enabled() -> bool:
    return os.getenv("HERMES_MODEL_COUNCIL_ENABLED", "false").strip().lower() in {"1", "true", "yes", "on"}


class ModelCouncilPolicy:
    def __init__(self, provider_call: ProviderCall, verification_hook: VerificationHook | None = None) -> None:
        self._executor = CouncilExecutor(provider_call)
        self._verifier = CouncilVerifier(verification_hook)
        self._evaluator = CouncilEvaluator()

    async def run(self, request: CouncilRequest) -> CouncilResult:
        if not model_council_enabled():
            return CouncilResult(mode=request.mode, verification_required=request.require_verification, blocked_reason="feature_disabled")

        if request.mode is CouncilMode.FAST and len(request.candidates) > 1:
            request = request.model_copy(update={"candidates": request.candidates[:1], "max_parallel": 1})
        elif request.mode in {CouncilMode.SMART, CouncilMode.REDTEAM} and len(request.candidates) > 3:
            request = request.model_copy(update={"candidates": request.candidates[:3], "max_parallel": min(request.max_parallel, 3)})

        candidates = await self._executor.run(request)
        total_cost = sum(item.cost_usd or 0.0 for item in candidates)
        if request.max_total_cost_usd is not None and total_cost > request.max_total_cost_usd:
            return CouncilResult(mode=request.mode, candidates=candidates, verification_required=request.require_verification, blocked_reason="cost_ceiling_exceeded", total_cost_usd=total_cost)

        ranked = self._evaluator.rank(candidates)
        for candidate in ranked:
            if await self._verifier.verify(candidate, request):
                return CouncilResult(mode=request.mode, winner=candidate, candidates=ranked, verification_required=request.require_verification, verification_passed=True, total_cost_usd=total_cost)

        reason = "verification_failed" if ranked else "no_candidates"
        if ranked and not any(item.success and item.safety_passed for item in ranked):
            reason = "no_eligible_candidate"
        return CouncilResult(mode=request.mode, candidates=ranked, verification_required=request.require_verification, blocked_reason=reason, total_cost_usd=total_cost)
