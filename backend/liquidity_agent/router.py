from __future__ import annotations

import os

from fastapi import APIRouter, Query

from .models import LiquidityAction, LiquidityRequest, LiquidityResponse
from .service import discover_liquidity_intelligence, run_liquidity_agent_async

router = APIRouter(prefix="/api/liquidity", tags=["liquidity-agent"])


@router.get("/health")
async def liquidity_health():
    graph_url_configured = bool(os.getenv("LIQUIDITY_UNISWAP_V3_SUBGRAPH_URL"))
    graph_gateway_configured = bool(
        (os.getenv("LIQUIDITY_THE_GRAPH_API_KEY") or os.getenv("THE_GRAPH_API_KEY"))
        and os.getenv("LIQUIDITY_UNISWAP_V3_SUBGRAPH_ID")
    )
    graph_configured = graph_url_configured or graph_gateway_configured
    rpc_configured = bool(os.getenv("LIQUIDITY_BASE_RPC_URL") or os.getenv("BASE_RPC_URL"))
    return {
        "status": "ok",
        "version": "0.3",
        "mode": "simulation_only",
        "read_only_intelligence": True,
        "canonical_pool_verification": "uniswap-v3-base",
        "uniswap_v4_state_verifier": "not_enabled",
        "sources": {
            "defillama_yields": "enabled",
            "base_rpc": "configured" if rpc_configured else "not_configured",
            "uniswap_v3_history": "configured" if graph_configured else "not_configured",
        },
        "foundry_plan_generation": True,
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


@router.post("/verify", response_model=LiquidityResponse)
async def liquidity_verify(request: LiquidityRequest) -> LiquidityResponse:
    """Canonical Base Uniswap V3 state verification using read-only RPC calls."""
    body = request.model_copy(update={"action": LiquidityAction.verify_pool_state})
    return await run_liquidity_agent_async(body)


@router.post("/history", response_model=LiquidityResponse)
async def liquidity_history(request: LiquidityRequest) -> LiquidityResponse:
    """Load selected-pool history from the configured fixed-schema indexer."""
    body = request.model_copy(update={"action": LiquidityAction.analyze_pool_history})
    return await run_liquidity_agent_async(body)


@router.post("/simulation-plan", response_model=LiquidityResponse)
async def liquidity_simulation_plan(request: LiquidityRequest) -> LiquidityResponse:
    """Build a pinned Foundry/Anvil fork plan without signing or broadcasting."""
    body = request.model_copy(update={"action": LiquidityAction.build_simulation_plan})
    return await run_liquidity_agent_async(body)


@router.post("/run", response_model=LiquidityResponse)
async def liquidity_run(request: LiquidityRequest) -> LiquidityResponse:
    """Run one liquidity-agent step; live data access remains read-only."""
    return await run_liquidity_agent_async(request)
