"""Aura adapter boundary for THE DOOR.

This v0.1 adapter intentionally does not invent a remote Aura API. It exposes
capabilities and deterministic placeholder execution so THE DOOR can be wired,
tested, and observed before a concrete editor transport is configured.
"""
from __future__ import annotations

from backend.the_door.contracts import DoorJob, DoorJobState, GameProject, VerificationResult


class AuraDoorAdapter:
    """Provider adapter for Aura-managed Unreal Engine execution."""

    @property
    def name(self) -> str:
        return "aura"

    @property
    def configured(self) -> bool:
        return False

    def capabilities(self) -> dict[str, object]:
        return {
            "provider": self.name,
            "engine": "unreal",
            "configured": self.configured,
            "mode": "adapter-boundary",
            "supports": [
                "build",
                "playtest",
                "observe",
                "diagnose",
                "repair",
                "verify",
            ],
        }

    async def execute(self, project: GameProject, job: DoorJob) -> DoorJob:
        job.state = DoorJobState.BLOCKED
        job.output = {
            "provider": self.name,
            "project_id": project.project_id,
            "reason": "Aura editor transport is not configured yet.",
        }
        return job

    async def verify(self, project: GameProject, job: DoorJob) -> VerificationResult:
        return VerificationResult(
            passed=False,
            checks=["provider-boundary", "editor-transport"],
            failures=["Aura editor transport is not configured yet."],
            observations={
                "provider": self.name,
                "project_id": project.project_id,
                "job_id": job.job_id,
            },
        )
