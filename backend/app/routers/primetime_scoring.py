"""Provider-neutral PRIMETIME scoring boundary.

The adapter deliberately has no direct provider credentials or outbound
network behavior. A concrete llama.cpp/GGUF implementation can be injected
behind this interface without changing the governed workflow contract.
"""
from __future__ import annotations

from dataclasses import dataclass
from typing import Protocol


@dataclass(frozen=True)
class LeadScore:
    score: float
    intent: float
    confidence: float
    model: str
    model_version: str


class LocalScorer(Protocol):
    async def score(self, *, lead_text: str, interaction_text: str) -> LeadScore: ...


class GovernedScoringAdapter:
    def __init__(self, scorer: LocalScorer) -> None:
        self._scorer = scorer

    async def score(self, *, lead_text: str, interaction_text: str) -> LeadScore:
        if len(lead_text) + len(interaction_text) > 120_000:
            raise ValueError("scoring context exceeds governed limit")
        result = await self._scorer.score(lead_text=lead_text, interaction_text=interaction_text)
        if not 0 <= result.score <= 100 or not 0 <= result.intent <= 100 or not 0 <= result.confidence <= 1:
            raise ValueError("scorer returned out-of-range values")
        return result
