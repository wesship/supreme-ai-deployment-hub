from __future__ import annotations

import httpx

from .discovery import DEFILLAMA_POOLS_URL, discover_defillama_pools
from .history import fetch_uniswap_v3_pool_history
from .models import (
    LiquidityAction,
    LiquidityRequest,
    LiquidityResponse,
    PoolHistorySummary,
    RankedPool,
    RiskAssessment,
)
from .policy import DEFAULT_POLICY, evaluate_request
from .rpc import base_rpc_snapshot
from .simulation import build_foundry_plan
from .uniswap_v3 import PoolVerificationError, verify_uniswap_v3_pool


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


def _execution_lock() -> dict[str, bool]:
    return {
        "private_key_access": False,
        "signing": False,
        "broadcast": False,
        "fund_movement": False,
        "production_execution": False,
    }


def run_liquidity_agent(request: LiquidityRequest) -> LiquidityResponse:
    """Run deterministic non-network actions while preserving the safety boundary."""
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

    if request.action in {
        LiquidityAction.verify_pool_state,
        LiquidityAction.analyze_pool_history,
        LiquidityAction.build_simulation_plan,
    }:
        return LiquidityResponse(
            action=request.action,
            status="read_only_async_required",
            message="This action requires the async read-only Base RPC/Graph verification path.",
            risk=risk,
            data={"execution": _execution_lock()},
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
            "execution": _execution_lock(),
        },
    )


def _pool_address(request: LiquidityRequest) -> str | None:
    if not request.pool:
        return None
    return request.pool.pool_address or (
        request.pool.pool_id
        if request.pool.pool_id and request.pool.pool_id.startswith("0x") and len(request.pool.pool_id) == 42
        else None
    )


def _state_mismatches(request: LiquidityRequest, state) -> list[str]:
    mismatches: list[str] = []
    pool = request.pool
    if not pool:
        return mismatches
    if pool.pool_address and pool.pool_address.lower() != state.pool_address.lower():
        mismatches.append("candidate_pool_address_mismatch")
    if pool.fee_tier is not None and pool.fee_tier != state.fee_tier:
        mismatches.append("candidate_fee_tier_mismatch")

    address_tokens = {
        value.lower()
        for value in pool.underlying_tokens
        if isinstance(value, str) and value.startswith("0x") and len(value) == 42
    }
    if len(address_tokens) >= 2 and not {
        state.token0_address.lower(),
        state.token1_address.lower(),
    }.issubset(address_tokens):
        mismatches.append("candidate_underlying_token_mismatch")
    return mismatches


async def _safe_history(pool_address: str, days: int) -> PoolHistorySummary:
    try:
        return await fetch_uniswap_v3_pool_history(pool_address, days=days)
    except (httpx.HTTPError, ValueError, TypeError) as exc:
        return PoolHistorySummary(
            status=f"unavailable:{type(exc).__name__}",
            source="uniswap_v3_subgraph",
            days_returned=0,
            points=[],
        )


async def verify_and_plan_liquidity(request: LiquidityRequest) -> LiquidityResponse:
    """Verify selected V3 pool state, enrich history, and optionally build a fork plan."""
    violations = evaluate_request(request)
    if violations:
        return LiquidityResponse(
            action=request.action,
            status="policy_blocked",
            message="Liquidity request was blocked before on-chain verification.",
            data={"violations": violations},
        )

    if request.chain.lower() != "base":
        return LiquidityResponse(
            action=request.action,
            status="policy_blocked",
            message="V0.3 direct pool verification is restricted to Base.",
            data={"violations": [f"chain_not_supported_by_v0_3_verifier:{request.chain.lower()}"]},
        )

    if request.protocol.lower() != "uniswap-v3":
        return LiquidityResponse(
            action=request.action,
            status="verifier_not_enabled",
            message="V0.3 uses the Uniswap V3 pool ABI only; V4 StateView verification is a separate gate.",
            data={
                "protocol": request.protocol,
                "execution": _execution_lock(),
            },
        )

    pool_address = _pool_address(request)
    if not pool_address:
        return LiquidityResponse(
            action=request.action,
            status="pool_address_required",
            message="A concrete pool address is required for canonical on-chain verification.",
            data={"execution": _execution_lock()},
        )

    try:
        state = await verify_uniswap_v3_pool(pool_address)
    except (PoolVerificationError, httpx.HTTPError, ValueError, TypeError) as exc:
        return LiquidityResponse(
            action=request.action,
            status="verification_failed",
            message="The pool could not be verified as a canonical Base Uniswap V3 pool.",
            data={
                "pool_address": pool_address,
                "reason": str(exc) if isinstance(exc, PoolVerificationError) else type(exc).__name__,
                "execution": _execution_lock(),
            },
        )

    mismatches = _state_mismatches(request, state)
    if mismatches:
        return LiquidityResponse(
            action=request.action,
            status="candidate_mismatch",
            message="Provider metadata does not match the canonical on-chain pool state.",
            data={
                "violations": mismatches,
                "verified_state": state.model_dump(),
                "execution": _execution_lock(),
            },
        )

    if state.liquidity <= 0 or not state.unlocked:
        state_violations = []
        if state.liquidity <= 0:
            state_violations.append("onchain_liquidity_is_zero")
        if not state.unlocked:
            state_violations.append("pool_not_unlocked")
        return LiquidityResponse(
            action=request.action,
            status="state_blocked",
            message="Canonical pool state was verified but is not eligible for simulation planning.",
            data={
                "violations": state_violations,
                "verified_state": state.model_dump(),
                "execution": _execution_lock(),
            },
        )

    risk = _risk_for(request)
    if "onchain_canonical_pool_verified" not in risk.reasons:
        risk.reasons.append("onchain_canonical_pool_verified")
        risk.score = min(100, risk.score + 5)

    history = await _safe_history(pool_address, request.history_days)
    fallback_history = {
        "volume_7d_usd": request.pool.volume_7d_usd if request.pool else None,
        "apy_mean_30d": request.pool.apy_mean_30d if request.pool else None,
    }

    base_data = {
        "verified_state": state.model_dump(),
        "history": history.model_dump(),
        "provider_history_fallback": fallback_history,
        "execution": _execution_lock(),
    }

    if request.action == LiquidityAction.verify_pool_state:
        return LiquidityResponse(
            action=request.action,
            status="canonical_pool_verified",
            message="Canonical Base Uniswap V3 pool state verified with read-only RPC calls.",
            risk=risk,
            data=base_data,
        )

    if request.action == LiquidityAction.analyze_pool_history:
        return LiquidityResponse(
            action=request.action,
            status="history_ready" if history.status == "ok" else "history_partial",
            message="Historical pool metrics loaded when the configured indexer is available.",
            risk=risk,
            data=base_data,
        )

    if request.action in {
        LiquidityAction.build_simulation_plan,
        LiquidityAction.simulate_deposit,
        LiquidityAction.simulate_rebalance,
    }:
        try:
            plan = build_foundry_plan(
                state,
                action=request.action.value,
                half_width_bps=request.range_half_width_bps,
            )
        except ValueError as exc:
            return LiquidityResponse(
                action=request.action,
                status="simulation_plan_blocked",
                message="A deterministic fork range plan could not be produced safely.",
                risk=risk,
                data={
                    **base_data,
                    "reason": str(exc),
                },
            )

        return LiquidityResponse(
            action=request.action,
            status="fork_plan_ready",
            message=(
                "A pinned Foundry/Anvil fork plan is ready. It contains no signing key, "
                "production transaction broadcast, or live fund movement."
            ),
            risk=risk,
            data={
                **base_data,
                "simulation_plan": plan.model_dump(),
            },
        )

    return LiquidityResponse(
        action=request.action,
        status="verified_analysis_ready",
        message="Selected pool analysis includes canonical on-chain state and optional historical indexing.",
        risk=risk,
        data=base_data,
    )


async def run_liquidity_agent_async(request: LiquidityRequest) -> LiquidityResponse:
    if request.action == LiquidityAction.discover_pools:
        return await discover_liquidity_intelligence(request)

    if request.action == LiquidityAction.analyze_pool and request.protocol.lower() != "uniswap-v3":
        return run_liquidity_agent(request)

    if request.action in {
        LiquidityAction.analyze_pool,
        LiquidityAction.verify_pool_state,
        LiquidityAction.analyze_pool_history,
        LiquidityAction.build_simulation_plan,
        LiquidityAction.simulate_deposit,
        LiquidityAction.simulate_rebalance,
    } and request.pool is not None:
        return await verify_and_plan_liquidity(request)

    return run_liquidity_agent(request)
