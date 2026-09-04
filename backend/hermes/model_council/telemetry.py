from __future__ import annotations

from collections.abc import Awaitable, Callable
from dataclasses import dataclass

from .schemas import CouncilResult


@dataclass(frozen=True)
class CouncilTelemetryEvent:
    mode: str
    candidate_count: int
    winner_model: str | None
    verification_passed: bool
    blocked_reason: str | None
    total_cost_usd: float
    shadow_mode: bool = False


TelemetrySink = Callable[[CouncilTelemetryEvent], Awaitable[None]]


def telemetry_event_from_result(result: CouncilResult) -> CouncilTelemetryEvent:
    shadow_mode = bool(result.metadata.get("shadow_mode"))
    winner_model = result.winner.model if result.winner is not None else None
    if shadow_mode:
        winner_model = result.metadata.get("shadow_selected_model")
    return CouncilTelemetryEvent(
        mode=result.mode.value,
        candidate_count=len(result.candidates),
        winner_model=winner_model,
        verification_passed=result.verification_passed,
        blocked_reason=result.blocked_reason,
        total_cost_usd=result.total_cost_usd,
        shadow_mode=shadow_mode,
    )
