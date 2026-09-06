from __future__ import annotations

import httpx

from .discovery import DEFILLAMA_POOLS_URL, discover_defillama_pools
from .models import (
    LiquidityAction,
    LiquidityRequest,
    LiquidityResponse,
    RankedPool,
    RiskAssessment,
)
from .policy import DEFAULT_POLICY, evaluate_request
from .rpc import base_rpc_snapshot


def _risk_for(request: LiquidityRequest) -> RiskAssessment:
    """Deterministic pool-quality score used for simulation screening, not trade advice."""
    score = 65
    reasons: list[str] = ["simulation_only", "safe_approval_required"]

    if request.pool:
        pool = request.pool
        if pool.tvl_usd is not None:
            if pool.tvl_usd >= 5_000_000:
                score += 10
                reasons.append("deep_pool_tvl")
            elif pool.tvl_usd >= 1_000_000:
                score += 7
                reasons.append("healthy_pool_tvl")

        if pool.volume_24h_usd is not None:
            if pool.volume_24h_usd >= 1_000_000:
                score += 10
                reasons.append("strong_recent_volume")
            elif pool.volume_24h_usd >= 250_000:
                score += 6
                reasons.append("healthy_recent_volume")

        if pool.reward_apy is not None and pool.reward_apy > 50:
            score -= 15
            reasons.append("high_incentive_apy_requires_review")

        if pool.apy_total is not None and pool.apy_mean_30d is not None:
            deviation = abs(pool.apy_total - pool.apy_mean_30d)
            if deviation > max(20.0, abs(pool.apy_mean_30d) * 2.0):
                score -= 10
                reasons.append("apy_deviates_from_30d_mean")

        if pool.outlier is True:
            score -= 25
            reasons.append("provider_marks_pool_outlier")

        if pool.il_risk and pool.il_risk.lower() in {"yes", "true", "high"}:
            score -= 10
            reasons.append("impermanent_loss_risk_flag")

        if pool.stablecoin is True:
            score += 3
            reasons.append("stablecoin_pool_flag")

    score = max(0, min(100, score))
    verdict = "approved_for_simulation" if score >= 60 else "manual_review_required"
    return RiskAssessment(score=score, verdict=verdict, reasons=reasons)


def run_liquidity_agent(request: LiquidityRequest) -> LiquidityResponse:
    """Run deterministic non-network actions while preserving the V0.1 safety boundary."""
    violations = evaluate_request(request)
    if violations:
        return LiquidityResponse(
            action=request.action,
            status="policy_blocked",
            message="Liquidity request was blocked by the D3VONN policy firewall.",
            data={"violations": violations},
        )

    risk = _risk_for(request)

    if request.action == LiquidityAction.discover_pools:
        return LiquidityResponse(
            action=request.action,
            status="read_only_async_required",
            message="Live pool discovery is available through the async liquidity service/API.",
            risk=risk,
            data={
                "chain": request.chain,
                "protocol": request.protocol,
                "preferred_sources": ["defillama_yields", "base_rpc"],
            },
        )

    if request.action in {LiquidityAction.simulate_deposit, LiquidityAction.simulate_rebalance}:
        return LiquidityResponse(
            action=request.action,
            status="simulation_required",
            message="Transaction plan may proceed only through a Foundry/Anvil fork simulation.",
            risk=risk,
            data={
                "simulator": "foundry_anvil",
                "broadcast": False,
                "policy": DEFAULT_POLICY.__dict__,
            },
        )

    if request.action == LiquidityAction.propose_safe_transaction:
        return LiquidityResponse(
            action=request.action,
            status="proposal_only",
            message="A Safe transaction may be prepared for human/multisig approval; signing and broadcasting remain disabled.",
            risk=risk,
            data={
                "custody_boundary": "safe_smart_account",
                "requires_simulation_pass": True,
                "requires_human_or_multisig_approval": True,
                "signing_enabled": False,
                "broadcast": False,
            },
        )

    return LiquidityResponse(
        action=request.action,
        status="analysis_ready",
        message="Liquidity analysis completed under the simulation-only policy.",
        risk=risk,
        data={"chain": request.chain, "protocol": request.protocol},
    )


async def discover_liquidity_intelligence(request: LiquidityRequest) -> LiquidityResponse:
    """Fetch, screen, score, and rank live pool data without any fund movement."""
    violations = evaluate_request(request)
    if violations:
        return LiquidityResponse(
            action=request.action,
            status="policy_blocked",
            message="Liquidity discovery request was blocked by the D3VONN policy firewall.",
            data={"violations": violations},
        )

    try:
        pools = await discover_defillama_pools(
            request.chain,
            request.protocol,
            limit=request.limit,
            policy=DEFAULT_POLICY,
        )
    except (httpx.HTTPError, ValueError, TypeError) as exc:
        return LiquidityResponse(
            action=request.action,
            status="source_unavailable",
            message="The read-only pool data source could not be queried safely.",
            data={
                "source": "defillama_yields",
                "error_type": type(exc).__name__,
                "retryable": True,
            },
        )

    ranked: list[RankedPool] = []
    scored = []
    for pool in pools:
        assessment = _risk_for(
            LiquidityRequest(
                action=LiquidityAction.analyze_pool,
                chain=pool.chain,
                protocol=pool.protocol,
                pool=pool,
            )
        )
        scored.append((assessment.score, pool.volume_24h_usd or 0.0, pool, assessment))

    scored.sort(key=lambda item: (item[0], item[1]), reverse=True)
    for index, (_, _, pool, assessment) in enumerate(scored, start=1):
        ranked.append(RankedPool(rank=index, pool=pool, risk=assessment))

    rpc = await base_rpc_snapshot() if request.chain.lower() == "base" else {"status": "not_applicable"}

    return LiquidityResponse(
        action=request.action,
        status="read_only_live" if ranked else "no_candidates",
        message=(
            "Live read-only pool intelligence is available; all candidates remain simulation-only."
            if ranked
            else "No pools passed the current D3VONN liquidity screening policy."
        ),
        data={
            "read_only": True,
            "chain": request.chain,
            "protocol": request.protocol,
            "source": "defillama_yields",
            "source_url": DEFILLAMA_POOLS_URL,
            "candidate_count": len(ranked),
            "candidates": [item.model_dump() for item in ranked],
            "historical_fields": ["apy_mean_30d", "volume_7d_usd"],
            "rpc_freshness": rpc,
            "screening_policy": DEFAULT_POLICY.__dict__,
            "execution": {
                "private_key_access": False,
                "signing": False,
                "broadcast": False,
                "fund_movement": False,
            },
        },
    )


async def run_liquidity_agent_async(request: LiquidityRequest) -> LiquidityResponse:
    if request.action == LiquidityAction.discover_pools:
        return await discover_liquidity_intelligence(request)
    return run_liquidity_agent(request)
