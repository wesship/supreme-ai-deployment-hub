"""Provider benchmarking primitives used by the AI Films router.

Scores are evidence, not activation. A provider still needs an authorized
API/worker integration and explicit production eligibility before execution.
"""
from __future__ import annotations

from dataclasses import dataclass


@dataclass(frozen=True)
class ProviderBenchmark:
    provider: str
    visual_quality: float = 0.0
    temporal_consistency: float = 0.0
    character_consistency: float = 0.0
    prompt_adherence: float = 0.0
    artifact_rate: float = 0.0
    latency: float = 0.0
    reliability: float = 0.0
    licensing: float = 0.0
    watermark: float = 0.0
    cost: float = 0.0

    def weighted_score(self) -> float:
        """Return a normalized score; lower artifact rate is better."""
        positive = (
            self.visual_quality
            + self.temporal_consistency
            + self.character_consistency
            + self.prompt_adherence
            + self.latency
            + self.reliability
            + self.licensing
            + self.watermark
            + self.cost
        )
        return positive / 9.0 - self.artifact_rate


def rank_providers(results: list[ProviderBenchmark]) -> list[ProviderBenchmark]:
    """Rank benchmark results without changing provider activation state."""
    return sorted(results, key=lambda item: item.weighted_score(), reverse=True)
