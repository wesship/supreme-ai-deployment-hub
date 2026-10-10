"""Authenticated API surface for the Hermes Proactivity Engine."""
from __future__ import annotations

from typing import Any

from fastapi import APIRouter, Depends
from pydantic import BaseModel

from backend.auth.supabase_jwt import require_occ_access
from backend.hermes.dependencies import get_dependencies
from backend.hermes.proactivity import ProactivityService, policy_from_env

router = APIRouter(prefix="/api/hermes/proactivity", tags=["hermes-proactivity"])
_cycle_service = ProactivityService()


class RunCycleRequest(BaseModel):
    dry_run: bool = False


@router.get("/status")
async def proactivity_status(_: Any = Depends(require_occ_access)):
    policy = policy_from_env()
    dependencies = get_dependencies()
    return {
        "configured": bool(dependencies.repository.configured),
        "background_enabled": __import__("os").getenv(
            "HERMES_PROACTIVITY_ENABLED", ""
        ).strip().lower()
        in {"1", "true", "yes", "on"},
        "execution_mode": "proposal_only_no_dispatch",
        "policy": policy.model_dump(mode="json"),
        "safety": {
            "dispatch_enabled": False,
            "external_side_effects_enabled": False,
            "proposal_status": "MANUAL_REVIEW",
            "idempotent_proposals": True,
        },
    }


@router.post("/cycle")
async def run_proactivity_cycle(
    body: RunCycleRequest,
    _: Any = Depends(require_occ_access),
):
    result = await _cycle_service.run_cycle(
        persist_proposals=not body.dry_run
    )
    return result.model_dump(mode="json")
