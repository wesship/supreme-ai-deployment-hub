from fastapi import APIRouter

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
def market_intelligence_query(payload: MarketIntelligenceQuery) -> MarketIntelligenceResponse:
    return _service.build_plan(payload)
