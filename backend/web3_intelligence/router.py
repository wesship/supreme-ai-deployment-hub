"""FastAPI router for Devonn.AI Web3 Intelligence."""

from __future__ import annotations

from fastapi import APIRouter

from .models import (
    ContractBlueprintRequest,
    ContractBlueprintResponse,
    ContractRiskRequest,
    ContractRiskResponse,
    ContractEventSubscription,
    ContractEventSubscriptionResponse,
    RpcHealthRequest,
    RpcHealthResponse,
    Web3GuideResponse,
)
from .service import (
    build_blueprint,
    check_rpc_health,
    get_clean_guide,
    plan_event_subscription,
    risk_check,
)

router = APIRouter(prefix="/api/web3", tags=["web3-intelligence"])


@router.get("/guide", response_model=Web3GuideResponse)
def read_web3_guide() -> Web3GuideResponse:
    """Return the cleaned Web3 smart-contract guide as structured knowledge."""
    return get_clean_guide()


@router.post("/risk-check", response_model=ContractRiskResponse)
def run_contract_risk_check(request: ContractRiskRequest) -> ContractRiskResponse:
    """Run a practical pre-build risk check for a smart-contract concept."""
    return risk_check(request)


@router.post("/blueprint", response_model=ContractBlueprintResponse)
def create_contract_blueprint(request: ContractBlueprintRequest) -> ContractBlueprintResponse:
    """Convert a Web3 concept into a Devonn.AI-ready implementation blueprint."""
    return build_blueprint(request)


@router.post("/events/subscriptions", response_model=ContractEventSubscriptionResponse)
def create_event_subscription_plan(
    request: ContractEventSubscription,
) -> ContractEventSubscriptionResponse:
    """Create a deterministic event-listener routing plan for Devonn.AI agents."""
    return plan_event_subscription(request)


@router.post("/rpc/health", response_model=RpcHealthResponse)
async def rpc_health(request: RpcHealthRequest) -> RpcHealthResponse:
    """Check whether an EVM RPC endpoint is reachable and on the expected chain."""
    return await check_rpc_health(request)
