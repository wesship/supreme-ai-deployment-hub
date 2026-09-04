"""FastAPI surface for THE DOOR game-development runtime."""
from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException

from backend.app.middleware.auth import get_current_user_id
from backend.the_door.aura_adapter import AuraDoorAdapter
from backend.the_door.blender_pipeline import BlenderAssetPipeline
from backend.the_door.contracts import (
    AssetPreparationRequest,
    AssetPreparationResult,
    DoorJob,
    EngineProvider,
    GameProject,
    VerificationResult,
)
from backend.the_door.open_source_adapters import build_open_source_adapters

router = APIRouter(prefix="/the-door")
_aura = AuraDoorAdapter()
_blender = BlenderAssetPipeline()
_adapters = {EngineProvider.AURA: _aura, **build_open_source_adapters()}


def _adapter_for(provider: EngineProvider):
    adapter = _adapters.get(provider)
    if adapter is None:
        raise HTTPException(status_code=409, detail=f"Provider {provider.value} has no registered adapter yet.")
    return adapter


@router.get("/health")
async def health() -> dict[str, object]:
    return {
        "status": "ok",
        "subsystem": "the-door",
        "purpose": "game-development",
        "control_plane": "multi-engine",
        "configured_engine_adapters": [
            provider.value for provider, adapter in _adapters.items() if adapter.configured
        ],
        "asset_pipeline_configured": _blender.configured,
    }


@router.get("/capabilities")
async def capabilities() -> dict[str, object]:
    return {
        "subsystem": "the-door",
        "workflow": ["build", "playtest", "observe", "diagnose", "repair", "verify"],
        "engine_adapters": [adapter.capabilities() for adapter in _adapters.values()],
        "asset_pipeline": _blender.capabilities(),
    }


@router.post("/jobs/execute", response_model=DoorJob)
async def execute_job(
    project: GameProject,
    job: DoorJob,
    _: str = Depends(get_current_user_id),
) -> DoorJob:
    return await _adapter_for(job.provider).execute(project, job)


@router.post("/jobs/verify", response_model=VerificationResult)
async def verify_job(
    project: GameProject,
    job: DoorJob,
    _: str = Depends(get_current_user_id),
) -> VerificationResult:
    return await _adapter_for(job.provider).verify(project, job)


@router.get("/assets/capabilities")
async def asset_capabilities() -> dict[str, object]:
    return _blender.capabilities()


@router.post("/assets/prepare", response_model=AssetPreparationResult)
async def prepare_asset(
    request: AssetPreparationRequest,
    _: str = Depends(get_current_user_id),
) -> AssetPreparationResult:
    return await _blender.prepare(request)
