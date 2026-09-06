from __future__ import annotations

from dataclasses import dataclass

from .models import LiquidityRequest


@dataclass(frozen=True)
class LiquidityPolicy:
    approved_chains: tuple[str, ...] = ("base",)
    approved_protocols: tuple[str, ...] = ("uniswap-v3", "uniswap-v4")
    max_position_usd: float = 25_000.0
    max_slippage_bps: int = 100
    min_pool_tvl_usd: float = 250_000.0
    min_volume_24h_usd: float = 50_000.0


DEFAULT_POLICY = LiquidityPolicy()


def evaluate_request(request: LiquidityRequest, policy: LiquidityPolicy = DEFAULT_POLICY) -> list[str]:
    """Return policy violations. Empty means the request may proceed to simulation/proposal."""
    violations: list[str] = []
    chain = request.chain.lower()
    protocol = request.protocol.lower()

    if chain not in policy.approved_chains:
        violations.append(f"chain_not_approved:{chain}")
    if protocol not in policy.approved_protocols:
        violations.append(f"protocol_not_approved:{protocol}")
    if request.amount_usd is not None and request.amount_usd > policy.max_position_usd:
        violations.append("position_limit_exceeded")
    if request.max_slippage_bps > policy.max_slippage_bps:
        violations.append("slippage_limit_exceeded")

    if request.pool:
        if request.pool.tvl_usd is not None and request.pool.tvl_usd < policy.min_pool_tvl_usd:
            violations.append("pool_tvl_below_minimum")
        if (
            request.pool.volume_24h_usd is not None
            and request.pool.volume_24h_usd < policy.min_volume_24h_usd
        ):
            violations.append("pool_volume_below_minimum")

    return violations
