from __future__ import annotations

from enum import Enum
from typing import Any, Dict, List, Optional

from pydantic import BaseModel, Field


class LiquidityMode(str, Enum):
    simulation_only = "simulation_only"


class LiquidityAction(str, Enum):
    discover_pools = "discover_pools"
    analyze_pool = "analyze_pool"
    simulate_deposit = "simulate_deposit"
    simulate_rebalance = "simulate_rebalance"
    propose_safe_transaction = "propose_safe_transaction"


class PoolCandidate(BaseModel):
    chain: str
    protocol: str
    pool_address: Optional[str] = None
    token0: str
    token1: str
    fee_tier: Optional[int] = None
    tvl_usd: Optional[float] = None
    volume_24h_usd: Optional[float] = None
    fee_apy: Optional[float] = None
    reward_apy: Optional[float] = None


class LiquidityRequest(BaseModel):
    action: LiquidityAction
    chain: str = "base"
    protocol: str = "uniswap-v3"
    pool: Optional[PoolCandidate] = None
    amount_usd: Optional[float] = Field(default=None, ge=0)
    max_slippage_bps: int = Field(default=50, ge=1, le=500)
    metadata: Dict[str, Any] = Field(default_factory=dict)


class RiskAssessment(BaseModel):
    score: int = Field(ge=0, le=100)
    verdict: str
    reasons: List[str] = Field(default_factory=list)


class LiquidityResponse(BaseModel):
    mode: LiquidityMode = LiquidityMode.simulation_only
    action: LiquidityAction
    status: str
    message: str
    risk: Optional[RiskAssessment] = None
    data: Dict[str, Any] = Field(default_factory=dict)
    live_execution_enabled: bool = False
    private_key_access: bool = False
    broadcast_enabled: bool = False
