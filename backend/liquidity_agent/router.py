from __future__ import annotations

import os

from fastapi import APIRouter, Query

from .models import LiquidityAction, LiquidityRequest, LiquidityResponse
from .service import discover_liquidity_intelligence, run_liquidity_agent_async
from .v4_service import run_v4_liquidity_agent

router = APIRouter(prefix="/api/liquidity", tags=["liquidity-agent"])


def _is_v4(request: LiquidityRequest) -> bool:
    return request.protocol.lower() == "uniswap-v4"


async def _run_protocol_aware(request: LiquidityRequest) -> LiquidityResponse:
    if _is_v4(request) and request.action != LiquidityAction.discover_pools:
        return await run_v4_liquidity_agent(request)
    return await run_liquidity_agent_async(request)


@router.get("/health")
async def liquidity_health():
    graph_url_configured = bool(os.getenv("LIQUIDITY_UNISWAP_V3_SUBGRAPH_URL"))
    graph_gateway_configured = bool(
        (os.getenv("LIQUIDITY_THE_GRAPH_API_KEY") or os.getenv("THE_GRAPH_API_KEY"))
        and os.getenv("LIQUIDITY_UNISWAP_V3_SUBGRAPH_ID")
    )
    graph_configured = graph_url_configured or graph_gateway_configured
    rpc_configured = bool(os.getenv("LIQUIDITY_BASE_RPC_URL") or os.getenv("BASE_RPC_URL"))
    hermes_configured = bool(os.getenv("SUPABASE_URL") and os.getenv("SUPABASE_SERVICE_ROLE_KEY"))
    return {
        "status": "ok",
        "version": "0.5",
        "mode": "simulation_only",
        "read_only_intelligence": True,
        "canonical_pool_verification": ["uniswap-v3-base", "uniswap-v4-base-stateview"],
        "uniswap_v4_state_verifier": "enabled",
        "uniswap_v4_position_manager_harness": "fork_only",
        "trusted_simulation_certification": "manual_workflow_dispatch",
        "hermes_certificate_persistence": "configured" if hermes_configured else "not_configured",
        "safe_proposal_preparation": "persisted_certificate_gated",
        "safe_submission_enabled": False,
        "sources": {
            "defillama_yields": "enabled",
            "base_rpc": "configured" if rpc_configured else "not_configured",
            "uniswap_v3_history": "configured" if graph_configured else "not_configured",
            "uniswap_v4_deployments": "pinned_official_uniswap_manifest",
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
    """Canonical V3 pool or V4 StateView verification using read-only RPC calls."""
    body = request.model_copy(update={"action": LiquidityAction.verify_pool_state})
    return await _run_protocol_aware(body)


@router.post("/history", response_model=LiquidityResponse)
async def liquidity_history(request: LiquidityRequest) -> LiquidityResponse:
    """Load selected-pool history where an explicitly configured source exists."""
    body = request.model_copy(update={"action": LiquidityAction.analyze_pool_history})
    return await _run_protocol_aware(body)


@router.post("/simulation-plan", response_model=LiquidityResponse)
async def liquidity_simulation_plan(request: LiquidityRequest) -> LiquidityResponse:
    """Build a pinned fork plan without production signing or broadcasting."""
    body = request.model_copy(update={"action": LiquidityAction.build_simulation_plan})
    return await _run_protocol_aware(body)


@router.post("/v4/verify", response_model=LiquidityResponse)
async def liquidity_v4_verify(request: LiquidityRequest) -> LiquidityResponse:
    body = request.model_copy(
        update={"action": LiquidityAction.verify_pool_state, "chain": "base", "protocol": "uniswap-v4"}
    )
    return await run_v4_liquidity_agent(body)


@router.post("/v4/simulation-plan", response_model=LiquidityResponse)
async def liquidity_v4_simulation_plan(request: LiquidityRequest) -> LiquidityResponse:
    body = request.model_copy(
        update={"action": LiquidityAction.build_simulation_plan, "chain": "base", "protocol": "uniswap-v4"}
    )
    return await run_v4_liquidity_agent(body)


@router.post("/run", response_model=LiquidityResponse)
async def liquidity_run(request: LiquidityRequest) -> LiquidityResponse:
    """Run one protocol-aware liquidity-agent step under the simulation-only boundary."""
    return await _run_protocol_aware(request)
