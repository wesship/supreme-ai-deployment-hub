from __future__ import annotations

from enum import Enum
from typing import Any, Dict, List, Optional

from pydantic import BaseModel, Field


class LiquidityMode(str, Enum):
    simulation_only = "simulation_only"


class LiquidityAction(str, Enum):
    discover_pools = "discover_pools"
    analyze_pool = "analyze_pool"
    verify_pool_state = "verify_pool_state"
    analyze_pool_history = "analyze_pool_history"
    build_simulation_plan = "build_simulation_plan"
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


class V4PoolKey(BaseModel):
    currency0_address: str
    currency1_address: str
    fee: int = Field(ge=0, le=16_777_215)
    tick_spacing: int = Field(ge=1, le=32767)
    hooks_address: str = "0x0000000000000000000000000000000000000000"


class LiquidityRequest(BaseModel):
    action: LiquidityAction
    chain: str = "base"
    protocol: str = "uniswap-v3"
    pool: Optional[PoolCandidate] = None
    v4_pool_key: Optional[V4PoolKey] = None
    amount_usd: Optional[float] = Field(default=None, ge=0)
    max_slippage_bps: int = Field(default=50, ge=1, le=500)
    limit: int = Field(default=10, ge=1, le=50)
    history_days: int = Field(default=30, ge=1, le=90)
    range_half_width_bps: int = Field(default=500, ge=50, le=5000)
    metadata: Dict[str, Any] = Field(default_factory=dict)


class RiskAssessment(BaseModel):
    score: int = Field(ge=0, le=100)
    verdict: str
    reasons: List[str] = Field(default_factory=list)


class RankedPool(BaseModel):
    rank: int = Field(ge=1)
    pool: PoolCandidate
    risk: RiskAssessment


class PoolStateSnapshot(BaseModel):
    chain: str
    protocol: str
    verified: bool
    verification_checks: List[str] = Field(default_factory=list)
    block_number: int = Field(ge=0)
    pool_address: str
    canonical_factory: str
    token0_address: str
    token1_address: str
    token0_decimals: Optional[int] = Field(default=None, ge=0, le=36)
    token1_decimals: Optional[int] = Field(default=None, ge=0, le=36)
    fee_tier: int = Field(ge=0)
    tick_spacing: int
    sqrt_price_x96: int = Field(ge=0)
    tick: int
    liquidity: int = Field(ge=0)
    unlocked: bool
    price_token1_per_token0: Optional[str] = None


class V4PoolStateSnapshot(BaseModel):
    chain: str = "base"
    protocol: str = "uniswap-v4"
    verified: bool
    verification_checks: List[str] = Field(default_factory=list)
    block_number: int = Field(ge=0)
    pool_id: str
    canonical_pool_manager: str
    canonical_position_manager: str
    canonical_state_view: str
    sqrt_price_x96: int = Field(ge=0)
    tick: int
    protocol_fee: int = Field(ge=0)
    lp_fee: int = Field(ge=0)
    liquidity: int = Field(ge=0)
    pool_key_hash_verified_on_server: bool = False


class PoolHistoryPoint(BaseModel):
    date: int = Field(ge=0)
    liquidity: Optional[str] = None
    sqrt_price_x96: Optional[str] = None
    token0_price: Optional[float] = None
    token1_price: Optional[float] = None
    tick: Optional[int] = None
    tvl_usd: Optional[float] = None
    volume_usd: Optional[float] = None
    fees_usd: Optional[float] = None
    tx_count: Optional[int] = None


class PoolHistorySummary(BaseModel):
    status: str
    source: str
    days_returned: int = Field(ge=0)
    avg_tvl_usd: Optional[float] = None
    total_volume_usd: Optional[float] = None
    total_fees_usd: Optional[float] = None
    fee_to_avg_tvl_bps: Optional[float] = None
    annualized_fee_to_avg_tvl_pct: Optional[float] = None
    points: List[PoolHistoryPoint] = Field(default_factory=list)


class RangePlan(BaseModel):
    current_tick: int
    lower_tick: int
    upper_tick: int
    tick_spacing: int
    requested_half_width_bps: int
    approximate_price_width_pct: float
    current_tick_in_range: bool


class ForkSimulationPlan(BaseModel):
    status: str
    action: str
    chain_id: int
    fork_block_number: int
    pool_address: str
    rpc_env_var: str
    range_plan: RangePlan
    anvil_command: List[str] = Field(default_factory=list)
    readback_commands: List[List[str]] = Field(default_factory=list)
    simulation_steps: List[str] = Field(default_factory=list)
    requires_position_manager_harness: bool = True
    private_key_access: bool = False
    signing_enabled: bool = False
    broadcast_enabled: bool = False
    production_execution_enabled: bool = False


class V4ForkHarnessPlan(BaseModel):
    status: str = "fork_harness_ready"
    chain_id: int = 8453
    fork_block_number: int = Field(ge=0)
    pool_id: str
    rpc_env_var: str = "LIQUIDITY_BASE_RPC_URL"
    canonical_pool_manager: str
    canonical_position_manager: str
    canonical_state_view: str
    pool_key: V4PoolKey
    range_plan: RangePlan
    harness_path: str = "tools/liquidity_v4/test/D3VONNLiquidityV4Fork.t.sol"
    scenarios: List[str] = Field(default_factory=list)
    invariants: List[str] = Field(default_factory=list)
    forge_command: List[str] = Field(default_factory=list)
    report_schema: Dict[str, Any] = Field(default_factory=dict)
    pool_id_recomputed_in_foundry: bool = True
    test_only_funded_account: bool = True
    private_key_access: bool = False
    signing_enabled: bool = False
    broadcast_enabled: bool = False
    production_execution_enabled: bool = False


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
