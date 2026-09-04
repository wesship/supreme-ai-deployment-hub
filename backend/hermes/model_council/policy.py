from __future__ import annotations

import os

from .evaluator import CouncilEvaluator
from .executor import CouncilExecutor, ProviderCall
from .schemas import CouncilMode, CouncilRequest, CouncilResult
from .telemetry import TelemetrySink, telemetry_event_from_result
from .verifier import CouncilVerifier, VerificationHook


def _env_flag(name: str, default: str = "false") -> bool:
    return os.getenv(name, default).strip().lower() in {"1", "true", "yes", "on"}


def model_council_enabled() -> bool:
    return _env_flag("HERMES_MODEL_COUNCIL_ENABLED")


def model_council_shadow_mode() -> bool:
    return _env_flag("HERMES_MODEL_COUNCIL_SHADOW_MODE")


class ModelCouncilPolicy:
    def __init__(
        self,
        provider_call: ProviderCall,
        verification_hook: VerificationHook | None = None,
        telemetry_sink: TelemetrySink | None = None,
    ) -> None:
        self._executor = CouncilExecutor(provider_call)
        self._verifier = CouncilVerifier(verification_hook)
        self._evaluator = CouncilEvaluator()
        self._telemetry_sink = telemetry_sink

    async def _finalize(self, result: CouncilResult) -> CouncilResult:
        if self._telemetry_sink is not None:
            try:
                await self._telemetry_sink(telemetry_event_from_result(result))
            except Exception:
                # Telemetry is observational only and must never affect authority.
                pass
        return result

    async def run(self, request: CouncilRequest) -> CouncilResult:
        if not model_council_enabled():
            return await self._finalize(CouncilResult(mode=request.mode, verification_required=request.require_verification, blocked_reason="feature_disabled"))

        if request.mode is CouncilMode.FAST and len(request.candidates) > 1:
            request = request.model_copy(update={"candidates": request.candidates[:1], "max_parallel": 1})
        elif request.mode in {CouncilMode.SMART, CouncilMode.REDTEAM} and len(request.candidates) > 3:
            request = request.model_copy(update={"candidates": request.candidates[:3], "max_parallel": min(request.max_parallel, 3)})

        candidates = await self._executor.run(request)
        total_cost = sum(item.cost_usd or 0.0 for item in candidates)
        if request.max_total_cost_usd is not None and total_cost > request.max_total_cost_usd:
            return await self._finalize(CouncilResult(mode=request.mode, candidates=candidates, verification_required=request.require_verification, blocked_reason="cost_ceiling_exceeded", total_cost_usd=total_cost))

        ranked = self._evaluator.rank(candidates)
        selected = None
        for candidate in ranked:
            if await self._verifier.verify(candidate, request):
                selected = candidate
                break

        if selected is not None:
            if model_council_shadow_mode():
                return await self._finalize(CouncilResult(
                    mode=request.mode,
                    winner=None,
                    candidates=ranked,
                    verification_required=request.require_verification,
                    verification_passed=True,
                    blocked_reason="shadow_mode_non_authoritative",
                    total_cost_usd=total_cost,
                    metadata={
                        "shadow_mode": True,
                        "shadow_selected_provider": selected.provider,
                        "shadow_selected_model": selected.model,
                        "shadow_selected_score": selected.score,
                    },
                ))
            return await self._finalize(CouncilResult(mode=request.mode, winner=selected, candidates=ranked, verification_required=request.require_verification, verification_passed=True, total_cost_usd=total_cost))

        reason = "verification_failed" if ranked else "no_candidates"
        if ranked and not any(item.success and item.safety_passed for item in ranked):
            reason = "no_eligible_candidate"
        return await self._finalize(CouncilResult(mode=request.mode, candidates=ranked, verification_required=request.require_verification, blocked_reason=reason, total_cost_usd=total_cost, metadata={"shadow_mode": model_council_shadow_mode()}))
