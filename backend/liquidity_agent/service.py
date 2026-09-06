from __future__ import annotations

from .models import LiquidityAction, LiquidityRequest, LiquidityResponse, RiskAssessment
from .policy import DEFAULT_POLICY, evaluate_request


def _risk_for(request: LiquidityRequest) -> RiskAssessment:
    """Deterministic V0.1 risk stub. Live market scoring is added behind vetted data adapters."""
    score = 70
    reasons: list[str] = ["simulation_only", "safe_approval_required"]

    if request.pool:
        if request.pool.tvl_usd is not None and request.pool.tvl_usd >= 1_000_000:
            score += 8
            reasons.append("healthy_pool_tvl")
        if request.pool.volume_24h_usd is not None and request.pool.volume_24h_usd >= 250_000:
            score += 7
            reasons.append("healthy_recent_volume")
        if request.pool.reward_apy is not None and request.pool.reward_apy > 50:
            score -= 15
            reasons.append("high_incentive_apy_requires_review")

    score = max(0, min(100, score))
    verdict = "approved_for_simulation" if score >= 60 else "manual_review_required"
    return RiskAssessment(score=score, verdict=verdict, reasons=reasons)


def run_liquidity_agent(request: LiquidityRequest) -> LiquidityResponse:
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
            status="adapter_required",
            message="Pool discovery contract is ready; connect the vetted DefiLlama/indexer adapter before returning live pool data.",
            risk=risk,
            data={
                "chain": request.chain,
                "protocol": request.protocol,
                "preferred_sources": ["defillama_yields", "graph_node", "direct_rpc"],
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
        message="Liquidity analysis completed under the V0.1 simulation-only policy.",
        risk=risk,
        data={"chain": request.chain, "protocol": request.protocol},
    )
