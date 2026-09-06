from __future__ import annotations

import os

from fastapi import APIRouter, Query

from .models import LiquidityAction, LiquidityRequest, LiquidityResponse
from .service import discover_liquidity_intelligence, run_liquidity_agent_async

router = APIRouter(prefix="/api/liquidity", tags=["liquidity-agent"])


@router.get("/health")
async def liquidity_health():
    return {
        "status": "ok",
        "version": "0.2",
        "mode": "simulation_only",
        "read_only_intelligence": True,
        "sources": {
            "defillama_yields": "enabled",
            "base_rpc": "configured"
            if bool(os.getenv("LIQUIDITY_BASE_RPC_URL") or os.getenv("BASE_RPC_URL"))
            else "not_configured",
        },
        "live_execution_enabled": False,
        "private_key_access": False,
        "broadcast_enabled": False,
    }


@router.get("/pools", response_model=LiquidityResponse)
async def liquidity_pools(
    chain: str = Query(default="base"),
    protocol: str = Query(default="uniswap-v3"),
    limit: int = Query(default=10, ge=1, le=50),
) -> LiquidityResponse:
    """Return screened live pool intelligence without signing or broadcasting."""
    return await discover_liquidity_intelligence(
        LiquidityRequest(
            action=LiquidityAction.discover_pools,
            chain=chain,
            protocol=protocol,
            limit=limit,
        )
    )


@router.post("/run", response_model=LiquidityResponse)
async def liquidity_run(request: LiquidityRequest) -> LiquidityResponse:
    """Run one liquidity-agent step; discovery may read live data but cannot move funds."""
    return await run_liquidity_agent_async(request)
