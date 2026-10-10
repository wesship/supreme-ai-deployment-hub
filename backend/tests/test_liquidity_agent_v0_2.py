import asyncio

from backend.liquidity_agent import service
from backend.liquidity_agent.discovery import normalize_defillama_pool
from backend.liquidity_agent.models import LiquidityAction, LiquidityRequest, PoolCandidate
from backend.liquidity_agent.rpc import ALLOWED_RPC_METHODS


def test_defillama_pool_normalization_keeps_historical_fields():
    pool = normalize_defillama_pool(
        {
            "chain": "Base",
            "project": "uniswap-v3",
            "symbol": "USDC-WETH",
            "tvlUsd": 5_000_000,
            "apyBase": 11.5,
            "apyReward": 2.5,
            "apy": 14.0,
            "apyMean30d": 10.2,
            "volumeUsd1d": 1_500_000,
            "volumeUsd7d": 8_000_000,
            "pool": "0x1111111111111111111111111111111111111111",
            "underlyingTokens": ["0xaaa", "0xbbb"],
            "stablecoin": False,
            "ilRisk": "yes",
            "outlier": False,
        }
    )

    assert pool.chain == "base"
    assert pool.protocol == "uniswap-v3"
    assert pool.token0 == "USDC"
    assert pool.token1 == "WETH"
    assert pool.volume_7d_usd == 8_000_000
    assert pool.apy_mean_30d == 10.2
    assert pool.source == "defillama_yields"


def test_rpc_probe_cannot_select_transaction_methods():
    assert ALLOWED_RPC_METHODS == ("eth_chainId", "eth_blockNumber")
    assert "eth_sendRawTransaction" not in ALLOWED_RPC_METHODS
    assert "eth_sendTransaction" not in ALLOWED_RPC_METHODS
    assert "personal_sign" not in ALLOWED_RPC_METHODS


def test_live_discovery_remains_read_only(monkeypatch):
    async def fake_discovery(chain, protocol, *, limit, policy):
        assert chain == "base"
        assert protocol == "uniswap-v3"
        assert limit == 5
        return [
            PoolCandidate(
                source="defillama_yields",
                chain="base",
                protocol="uniswap-v3",
                symbol="USDC-WETH",
                token0="USDC",
                token1="WETH",
                tvl_usd=8_000_000,
                volume_24h_usd=2_000_000,
                volume_7d_usd=10_000_000,
                fee_apy=12,
                apy_total=12,
                apy_mean_30d=11,
            )
        ]

    async def fake_rpc():
        return {"configured": True, "status": "ok", "chain_id": 8453, "block_number": 123}

    monkeypatch.setattr(service, "discover_defillama_pools", fake_discovery)
    monkeypatch.setattr(service, "base_rpc_snapshot", fake_rpc)

    response = asyncio.run(
        service.discover_liquidity_intelligence(
            LiquidityRequest(
                action=LiquidityAction.discover_pools,
                chain="base",
                protocol="uniswap-v3",
                limit=5,
            )
        )
    )

    assert response.status == "read_only_live"
    assert response.data["candidate_count"] == 1
    assert response.data["rpc_freshness"]["chain_id"] == 8453
    assert response.live_execution_enabled is False
    assert response.private_key_access is False
    assert response.broadcast_enabled is False
    assert response.data["execution"]["fund_movement"] is False
