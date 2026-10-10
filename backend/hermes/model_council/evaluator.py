from __future__ import annotations

from .schemas import CandidateResult


class CouncilEvaluator:
    """Rank successful candidates; safety remains a separate hard gate."""

    def score(self, candidate: CandidateResult) -> float:
        if not candidate.success or not candidate.safety_passed:
            candidate.score = 0.0
            return candidate.score

        quality = (
            candidate.groundedness * 0.30
            + candidate.task_completion * 0.25
            + candidate.consistency * 0.15
            + candidate.tool_correctness * 0.15
            + candidate.confidence * 0.15
        )
        latency_penalty = min(candidate.latency_ms / 120_000, 1.0) * 0.05
        cost_penalty = min((candidate.cost_usd or 0.0) / 1.0, 1.0) * 0.05
        candidate.score = max(0.0, min(1.0, quality - latency_penalty - cost_penalty))
        return candidate.score

    def rank(self, candidates: list[CandidateResult]) -> list[CandidateResult]:
        for candidate in candidates:
            self.score(candidate)
        return sorted(candidates, key=lambda item: item.score, reverse=True)
