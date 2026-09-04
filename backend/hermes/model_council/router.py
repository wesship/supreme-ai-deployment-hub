from __future__ import annotations

from .schemas import CouncilMode


class CouncilRouter:
    def choose(self, *, complexity: float = 0.0, risk: float = 0.0, adversarial: bool = False) -> CouncilMode:
        if adversarial or risk >= 0.8:
            return CouncilMode.REDTEAM
        if complexity >= 0.5 or risk >= 0.4:
            return CouncilMode.SMART
        return CouncilMode.FAST
