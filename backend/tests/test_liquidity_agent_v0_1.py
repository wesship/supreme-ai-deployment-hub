from backend.liquidity_agent.models import LiquidityAction, LiquidityRequest, PoolCandidate
from backend.liquidity_agent.service import run_liquidity_agent


def test_live_execution_is_always_disabled():
    response = run_liquidity_agent(
        LiquidityRequest(action=LiquidityAction.propose_safe_transaction)
    )
    assert response.live_execution_enabled is False
    assert response.private_key_access is False
    assert response.broadcast_enabled is False
    assert response.status == "proposal_only"


def test_unapproved_chain_is_blocked():
    response = run_liquidity_agent(
        LiquidityRequest(action=LiquidityAction.analyze_pool, chain="ethereum")
    )
    assert response.status == "policy_blocked"
    assert "chain_not_approved:ethereum" in response.data["violations"]


def test_excess_slippage_is_blocked():
    response = run_liquidity_agent(
        LiquidityRequest(action=LiquidityAction.simulate_deposit, max_slippage_bps=150)
    )
    assert response.status == "policy_blocked"
    assert "slippage_limit_exceeded" in response.data["violations"]


def test_low_liquidity_pool_is_blocked():
    pool = PoolCandidate(
        chain="base",
        protocol="uniswap-v3",
        token0="USDC",
        token1="WETH",
        tvl_usd=100_000,
        volume_24h_usd=25_000,
    )
    response = run_liquidity_agent(
        LiquidityRequest(action=LiquidityAction.analyze_pool, pool=pool)
    )
    assert response.status == "policy_blocked"
    assert "pool_tvl_below_minimum" in response.data["violations"]
    assert "pool_volume_below_minimum" in response.data["violations"]
