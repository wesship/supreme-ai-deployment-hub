from fastapi import APIRouter, Depends, HTTPException, status

from backend.auth.supabase_jwt import OCCPrincipal, require_occ_access
from backend.hermes.market_analysis import create_ion_market_analysis_task

from .models import MarketIntelligenceQuery, MarketIntelligenceResponse
from .service import MarketIntelligenceService

router = APIRouter(prefix="/api/market-intelligence", tags=["market-intelligence"])
_service = MarketIntelligenceService()


@router.get("/health")
def market_intelligence_health():
    providers = _service.provider_statuses()
    return {
        "status": "ok",
        "mode": "read_only",
        "orchestrator": "hermes",
        "execution_enabled": False,
        "signing_enabled": False,
        "broadcast_enabled": False,
        "providers": [provider.model_dump() for provider in providers],
    }


@router.post("/query", response_model=MarketIntelligenceResponse)
async def market_intelligence_query(payload: MarketIntelligenceQuery) -> MarketIntelligenceResponse:
    """Run a public, non-persisting market-intelligence query."""
    if payload.save_to_dkos:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="DKOS persistence requires OCC operator access.",
        )
    return await _service.query(payload)


@router.post("/query/persist", response_model=MarketIntelligenceResponse)
async def market_intelligence_query_persist(
    payload: MarketIntelligenceQuery,
    _: OCCPrincipal = Depends(require_occ_access),
) -> MarketIntelligenceResponse:
    """Run research and persist only when an authorized operator opts in."""
    if not payload.save_to_dkos:
        payload = payload.model_copy(update={"save_to_dkos": True})
    return await _service.query(payload)


@router.post("/query/ion")
async def market_intelligence_query_ion(
    payload: MarketIntelligenceQuery,
    _: OCCPrincipal = Depends(require_occ_access),
) -> dict:
    """Run read-only market intelligence and hand ranked evidence to ION for analysis.

    This route is operator-gated because it creates a Hermes task. The handoff policy
    remains analysis-only and explicitly disables execution, trading, signing, and broadcast.
    """
    response = await _service.query(payload)
    task = await create_ion_market_analysis_task(response)
    return {
        "market_intelligence": response.model_dump(mode="json", by_alias=True),
        "ion_task": {
            "id": task.get("id"),
            "status": task.get("status"),
            "agent_name": task.get("agent_name") or "ION",
            "task_type": task.get("task_type") or "market_analysis",
            "source": task.get("source") or "hermes_market_intelligence",
        },
        "policy": {
            "analysis_only": True,
            "execution_allowed": False,
            "trading_allowed": False,
            "signing_allowed": False,
            "broadcast_allowed": False,
        },
    }
