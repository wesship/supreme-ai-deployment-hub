from __future__ import annotations

import os
from collections.abc import Awaitable, Callable
from typing import Any

from backend.hermes.ports import EventSink

from .integrations import build_production_council_policy
from .policy import model_council_enabled, model_council_shadow_mode
from .schemas import CandidateSpec, CouncilMode, CouncilRequest

ShadowStepObserver = Callable[..., Awaitable[None]]


def _candidate_specs_from_env() -> list[CandidateSpec]:
    raw = os.getenv("HERMES_MODEL_COUNCIL_CANDIDATES", "")
    specs: list[CandidateSpec] = []
    for token in raw.split(","):
        token = token.strip()
        if not token or ":" not in token:
            continue
        provider, model = token.split(":", 1)
        provider = provider.strip()
        model = model.strip()
        if provider and model:
            specs.append(CandidateSpec(provider=provider, model=model))
    return specs


def _prompt_from_input(input_data: dict[str, Any]) -> str | None:
    for key in ("prompt", "query", "instruction", "task", "description"):
        value = input_data.get(key)
        if isinstance(value, str) and value.strip():
            return value.strip()
    return None


def build_shadow_step_observer(event_sink: EventSink) -> ShadowStepObserver:
    async def observe(
        *,
        execution_id: str,
        workflow_id: str,
        step_id: str,
        agent_name: str,
        input_data: dict[str, Any],
    ) -> None:
        if not (model_council_enabled() and model_council_shadow_mode()):
            return

        prompt = _prompt_from_input(input_data)
        candidates = _candidate_specs_from_env()
        if not prompt or not candidates:
            await event_sink.emit(
                {
                    "event": "model_council.shadow.skipped",
                    "execution_id": execution_id,
                    "workflow_id": workflow_id,
                    "step_id": step_id,
                    "agent_name": agent_name,
                    "reason": "missing_prompt" if not prompt else "no_candidates_configured",
                }
            )
            return

        await event_sink.emit(
            {
                "event": "model_council.shadow.started",
                "execution_id": execution_id,
                "workflow_id": workflow_id,
                "step_id": step_id,
                "agent_name": agent_name,
                "candidate_count": len(candidates),
            }
        )

        raw_evidence = input_data.get("evidence")
        evidence = raw_evidence if isinstance(raw_evidence, list) else []
        mode = CouncilMode.SMART if len(candidates) > 1 else CouncilMode.FAST
        request = CouncilRequest(
            prompt=prompt,
            mode=mode,
            candidates=candidates,
            context={"evidence": evidence},
            require_verification=bool(evidence),
        )

        try:
            result = await build_production_council_policy().run(request)
            await event_sink.emit(
                {
                    "event": "model_council.shadow.completed",
                    "execution_id": execution_id,
                    "workflow_id": workflow_id,
                    "step_id": step_id,
                    "agent_name": agent_name,
                    "candidate_count": len(result.candidates),
                    "verification_passed": result.verification_passed,
                    "blocked_reason": result.blocked_reason,
                    "total_cost_usd": result.total_cost_usd,
                    "selected_provider": result.metadata.get("shadow_selected_provider"),
                    "selected_model": result.metadata.get("shadow_selected_model"),
                    "selected_score": result.metadata.get("shadow_selected_score"),
                }
            )
        except Exception as exc:
            await event_sink.emit(
                {
                    "event": "model_council.shadow.failed",
                    "execution_id": execution_id,
                    "workflow_id": workflow_id,
                    "step_id": step_id,
                    "agent_name": agent_name,
                    "error_type": type(exc).__name__,
                }
            )

    return observe
