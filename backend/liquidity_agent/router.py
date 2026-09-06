from __future__ import annotations

from fastapi import APIRouter

from .models import LiquidityRequest, LiquidityResponse
from .service import run_liquidity_agent

router = APIRouter(prefix="/api/liquidity", tags=["liquidity-agent"])


@router.get("/health")
async def liquidity_health():
    return {
        "status": "ok",
        "mode": "simulation_only",
        "live_execution_enabled": False,
        "private_key_access": False,
        "broadcast_enabled": False,
    }


@router.post("/run", response_model=LiquidityResponse)
async def liquidity_run(request: LiquidityRequest) -> LiquidityResponse:
    """Run one deterministic liquidity-agent step without live fund movement."""
    return run_liquidity_agent(request)
