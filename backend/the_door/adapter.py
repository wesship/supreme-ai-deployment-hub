"""Engine adapter boundary for THE DOOR.

Concrete providers (Aura first, native Unreal later) implement this protocol.
Hermes and THE DOOR orchestration should depend only on this interface.
"""
from __future__ import annotations

from typing import Protocol

from backend.the_door.contracts import DoorJob, GameProject, VerificationResult


class DoorEngineAdapter(Protocol):
    """Provider-neutral execution contract for game-engine operations."""

    @property
    def name(self) -> str:
        ...

    async def execute(self, project: GameProject, job: DoorJob) -> DoorJob:
        """Execute one engine operation and return the updated job."""
        ...

    async def verify(self, project: GameProject, job: DoorJob) -> VerificationResult:
        """Verify the observable result of an executed engine operation."""
        ...
