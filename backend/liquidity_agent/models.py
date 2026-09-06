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
    source: str = "manual"
    chain: str
    protocol: str
    pool_id: Optional[str] = None
    pool_address: Optional[str] = None
    symbol: Optional[str] = None
    token0: Optional[str] = None
    token1: Optional[str] = None
    fee_tier: Optional[int] = None
    tvl_usd: Optional[float] = None
    volume_24h_usd: Optional[float] = None
    volume_7d_usd: Optional[float] = None
    fee_apy: Optional[float] = None
    reward_apy: Optional[float] = None
    apy_total: Optional[float] = None
    apy_mean_30d: Optional[float] = None
    stablecoin: Optional[bool] = None
    il_risk: Optional[str] = None
    exposure: Optional[str] = None
    outlier: Optional[bool] = None
    underlying_tokens: List[str] = Field(default_factory=list)


class LiquidityRequest(BaseModel):
    action: LiquidityAction
    chain: str = "base"
    protocol: str = "uniswap-v3"
    pool: Optional[PoolCandidate] = None
    amount_usd: Optional[float] = Field(default=None, ge=0)
    max_slippage_bps: int = Field(default=50, ge=1, le=500)
    limit: int = Field(default=10, ge=1, le=50)
    metadata: Dict[str, Any] = Field(default_factory=dict)


class RiskAssessment(BaseModel):
    score: int = Field(ge=0, le=100)
    verdict: str
    reasons: List[str] = Field(default_factory=list)


class RankedPool(BaseModel):
    rank: int = Field(ge=1)
    pool: PoolCandidate
    risk: RiskAssessment


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
