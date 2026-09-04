"""FastAPI surface for THE DOOR game-development runtime."""
from __future__ import annotations

from fastapi import APIRouter

from backend.the_door.aura_adapter import AuraDoorAdapter
from backend.the_door.contracts import DoorJob, GameProject, VerificationResult

router = APIRouter(prefix="/the-door")
_aura = AuraDoorAdapter()


@router.get("/health")
async def health() -> dict[str, object]:
    return {
        "status": "ok",
        "subsystem": "the-door",
        "purpose": "game-development",
        "engine": "unreal",
        "provider": _aura.name,
        "provider_configured": _aura.configured,
    }


@router.get("/capabilities")
async def capabilities() -> dict[str, object]:
    return {
        "subsystem": "the-door",
        "workflow": ["build", "playtest", "observe", "diagnose", "repair", "verify"],
        "adapter": _aura.capabilities(),
    }


@router.post("/jobs/execute", response_model=DoorJob)
async def execute_job(project: GameProject, job: DoorJob) -> DoorJob:
    return await _aura.execute(project, job)


@router.post("/jobs/verify", response_model=VerificationResult)
async def verify_job(project: GameProject, job: DoorJob) -> VerificationResult:
    return await _aura.verify(project, job)
