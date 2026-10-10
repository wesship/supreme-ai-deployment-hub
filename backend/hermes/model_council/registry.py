from __future__ import annotations

from dataclasses import dataclass
from typing import Iterable

from .schemas import CandidateSpec, CouncilMode


@dataclass(frozen=True)
class RegistryEntry:
    provider: str
    model: str
    modes: frozenset[CouncilMode]
    enabled: bool = True


class ModelRegistry:
    def __init__(self, entries: Iterable[RegistryEntry] = ()) -> None:
        self._entries = list(entries)

    def candidates_for(self, mode: CouncilMode) -> list[CandidateSpec]:
        return [CandidateSpec(provider=e.provider, model=e.model) for e in self._entries if e.enabled and mode in e.modes]
