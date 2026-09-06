import asyncio

from backend.liquidity_agent import service
from backend.liquidity_agent.history import normalize_history_point, summarize_history
from backend.liquidity_agent.models import (
    LiquidityAction,
    LiquidityRequest,
    PoolCandidate,
    PoolHistorySummary,
    PoolStateSnapshot,
)
from backend.liquidity_agent.simulation import build_foundry_plan, build_range_plan
from backend.liquidity_agent.uniswap_v3 import (
    BASE_UNISWAP_V3_FACTORY,
    SELECTOR_GET_POOL,
    _decode_slot0,
    _get_pool_calldata,
)


def _state() -> PoolStateSnapshot:
    return PoolStateSnapshot(
        chain="base",
        protocol="uniswap-v3",
        verified=True,
        verification_checks=["factory_get_pool_matches_candidate"],
        block_number=25_000_000,
        pool_address="0x1111111111111111111111111111111111111111",
        canonical_factory=BASE_UNISWAP_V3_FACTORY,
        token0_address="0x2222222222222222222222222222222222222222",
        token1_address="0x3333333333333333333333333333333333333333",
        token0_decimals=6,
        token1_decimals=18,
        fee_tier=3000,
        tick_spacing=60,
        sqrt_price_x96=2**96,
        tick=120,
        liquidity=1_000_000,
        unlocked=True,
        price_token1_per_token0="0.000001",
    )


def test_get_pool_calldata_is_fixed_and_abi_padded():
    calldata = _get_pool_calldata(
        "0x2222222222222222222222222222222222222222",
        "0x3333333333333333333333333333333333333333",
        3000,
    )
    assert calldata.startswith(SELECTOR_GET_POOL)
    assert len(calldata) == 2 + 8 + (64 * 3)


def test_slot0_decoder_handles_signed_tick():
    def word(value: int) -> str:
        return hex(value % (2**256))[2:].rjust(64, "0")

    encoded = "0x" + "".join(
        [
            word(2**96),
            word(-120),
            word(1),
            word(2),
            word(3),
            word(0),
            word(1),
        ]
    )
    sqrt_price_x96, tick, unlocked = _decode_slot0(encoded)
    assert sqrt_price_x96 == 2**96
    assert tick == -120
    assert unlocked is True


def test_range_plan_snaps_to_tick_spacing():
    plan = build_range_plan(_state(), half_width_bps=500)
    assert plan.lower_tick % 60 == 0
    assert plan.upper_tick % 60 == 0
    assert plan.lower_tick <= plan.current_tick < plan.upper_tick


def test_foundry_plan_never_contains_live_execution_authority():
    plan = build_foundry_plan(_state(), action="simulate_deposit")
    assert plan.private_key_access is False
    assert plan.signing_enabled is False
    assert plan.broadcast_enabled is False
    assert plan.production_execution_enabled is False
    assert "$LIQUIDITY_BASE_RPC_URL" in plan.anvil_command
    assert not any("private" in item.lower() for item in plan.anvil_command)


def test_history_summary_uses_observed_fees_not_forecast():
    points = [
        normalize_history_point(
            {
                "date": 1_700_000_000,
                "liquidity": "1000",
                "sqrtPrice": str(2**96),
                "token0Price": "1",
                "token1Price": "1",
                "tick": "0",
                "tvlUSD": "1000000",
                "volumeUSD": "500000",
                "feesUSD": "1500",
                "txCount": "100",
            }
        ),
        normalize_history_point(
            {
                "date": 1_700_086_400,
                "liquidity": "1100",
                "sqrtPrice": str(2**96),
                "token0Price": "1",
                "token1Price": "1",
                "tick": "0",
                "tvlUSD": "1200000",
                "volumeUSD": "600000",
                "feesUSD": "1800",
                "txCount": "120",
            }
        ),
    ]
    summary = summarize_history(points, "test")
    assert summary.days_returned == 2
    assert summary.total_fees_usd == 3300
    assert summary.total_volume_usd == 1_100_000
    assert summary.annualized_fee_to_avg_tvl_pct is not None


def test_v4_is_not_misread_with_v3_abi():
    request = LiquidityRequest(
        action=LiquidityAction.verify_pool_state,
        chain="base",
        protocol="uniswap-v4",
        pool=PoolCandidate(
            chain="base",
            protocol="uniswap-v4",
            pool_address="0x1111111111111111111111111111111111111111",
            token0="USDC",
            token1="WETH",
            tvl_usd=1_000_000,
            volume_24h_usd=250_000,
        ),
    )
    response = asyncio.run(service.verify_and_plan_liquidity(request))
    assert response.status == "verifier_not_enabled"
    assert response.live_execution_enabled is False
    assert response.private_key_access is False
    assert response.broadcast_enabled is False


def test_verified_pool_builds_fork_plan_without_broadcast(monkeypatch):
    async def fake_verify(_pool_address: str):
        return _state()

    async def fake_history(_pool_address: str, days: int = 30):
        return PoolHistorySummary(
            status="not_configured",
            source="test",
            days_returned=0,
            points=[],
        )

    monkeypatch.setattr(service, "verify_uniswap_v3_pool", fake_verify)
    monkeypatch.setattr(service, "fetch_uniswap_v3_pool_history", fake_history)

    request = LiquidityRequest(
        action=LiquidityAction.simulate_deposit,
        chain="base",
        protocol="uniswap-v3",
        pool=PoolCandidate(
            source="defillama_yields",
            chain="base",
            protocol="uniswap-v3",
            pool_address="0x1111111111111111111111111111111111111111",
            token0="USDC",
            token1="WETH",
            fee_tier=3000,
            tvl_usd=5_000_000,
            volume_24h_usd=1_000_000,
        ),
        amount_usd=1_000,
        range_half_width_bps=500,
    )
    response = asyncio.run(service.verify_and_plan_liquidity(request))
    assert response.status == "fork_plan_ready"
    assert response.data["verified_state"]["verified"] is True
    assert response.data["simulation_plan"]["broadcast_enabled"] is False
    assert response.data["simulation_plan"]["signing_enabled"] is False
    assert response.data["execution"]["fund_movement"] is False
