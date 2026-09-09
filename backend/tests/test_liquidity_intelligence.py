from backend.app.services.liquidity_intelligence import (
    LiquidityPoolSnapshot,
    rank_liquidity_opportunities,
    score_liquidity_opportunity,
    score_liquidity_risk,
)


def test_low_risk_pool_scores_higher_than_fragile_pool():
    strong = LiquidityPoolSnapshot(
        protocol="mature",
        chain="base",
        symbol="ETH/USDC",
        tvl_usd=80_000_000,
        volume_24h_usd=25_000_000,
        apy_pct=9.0,
        volatility_30d_pct=35.0,
        peg_deviation_pct=0.05,
        protocol_age_days=1400,
        audited=True,
        bridge_exposed=False,
        oracle_quality=95,
        asset_quality=92,
    )
    fragile = LiquidityPoolSnapshot(
        protocol="new",
        chain="unknown",
        symbol="TOKEN/USDC",
        tvl_usd=150_000,
        volume_24h_usd=30_000,
        apy_pct=120.0,
        volatility_30d_pct=160.0,
        peg_deviation_pct=3.0,
        protocol_age_days=25,
        audited=False,
        bridge_exposed=True,
        oracle_quality=30,
        asset_quality=25,
    )

    strong_score = score_liquidity_risk(strong)
    fragile_score = score_liquidity_risk(fragile)

    assert strong_score["overall_score"] > fragile_score["overall_score"]
    assert "thin_liquidity" in fragile_score["reasons"]
    assert "bridge_exposure" in fragile_score["reasons"]


def test_opportunity_is_non_executing_and_accounts_for_gas_drag():
    pool = LiquidityPoolSnapshot(
        protocol="mature",
        chain="ethereum",
        symbol="USDC/USDT",
        tvl_usd=75_000_000,
        volume_24h_usd=20_000_000,
        apy_pct=8.0,
        protocol_age_days=1200,
        audited=True,
        oracle_quality=95,
        asset_quality=95,
    )
    risk = score_liquidity_risk(pool)
    cheap = score_liquidity_opportunity(pool, risk["overall_score"], gas_cost_usd=2, allocation_usd=10_000)
    expensive = score_liquidity_opportunity(pool, risk["overall_score"], gas_cost_usd=500, allocation_usd=10_000)

    assert cheap["execution_enabled"] is False
    assert cheap["expected_net_apy_pct"] > expensive["expected_net_apy_pct"]


def test_ranking_prioritizes_risk_adjusted_opportunity_not_raw_apy():
    safe = LiquidityPoolSnapshot(
        protocol="safe",
        chain="base",
        symbol="ETH/USDC",
        tvl_usd=100_000_000,
        volume_24h_usd=30_000_000,
        apy_pct=12.0,
        volatility_30d_pct=30.0,
        protocol_age_days=1500,
        audited=True,
        oracle_quality=95,
        asset_quality=95,
    )
    risky = LiquidityPoolSnapshot(
        protocol="risky",
        chain="base",
        symbol="XYZ/USDC",
        tvl_usd=100_000,
        volume_24h_usd=10_000,
        apy_pct=90.0,
        volatility_30d_pct=170.0,
        protocol_age_days=20,
        audited=False,
        bridge_exposed=True,
        oracle_quality=20,
        asset_quality=20,
    )

    ranked = rank_liquidity_opportunities([risky, safe])

    assert ranked[0]["protocol"] == "safe"
    assert ranked[0]["opportunity"]["execution_enabled"] is False
