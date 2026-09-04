from __future__ import annotations

from dataclasses import dataclass


@dataclass(frozen=True)
class CouncilTelemetryEvent:
    mode: str
    candidate_count: int
    winner_model: str | None
    verification_passed: bool
    blocked_reason: str | None
    total_cost_usd: float
