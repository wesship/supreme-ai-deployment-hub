from __future__ import annotations

from dataclasses import dataclass
from typing import Any, Iterable


def _clamp(value: float, low: float = 0.0, high: float = 100.0) -> float:
    return max(low, min(high, value))


def _safe_float(value: Any, default: float = 0.0) -> float:
    try:
        if value is None:
            return default
        return float(value)
    except (TypeError, ValueError):
        return default


@dataclass(frozen=True)
class LiquidityPoolSnapshot:
    protocol: str
    chain: str
    symbol: str
    tvl_usd: float = 0.0
    volume_24h_usd: float = 0.0
    fees_24h_usd: float = 0.0
    apy_pct: float = 0.0
    volatility_30d_pct: float = 0.0
    peg_deviation_pct: float = 0.0
    protocol_age_days: int = 0
    audited: bool = False
    bridge_exposed: bool = False
    oracle_quality: float = 50.0
    asset_quality: float = 50.0

    @classmethod
    def from_mapping(cls, payload: dict[str, Any]) -> "LiquidityPoolSnapshot":
        return cls(
            protocol=str(payload.get("protocol") or "unknown"),
            chain=str(payload.get("chain") or "unknown"),
            symbol=str(payload.get("symbol") or "unknown"),
            tvl_usd=_safe_float(payload.get("tvl_usd")),
            volume_24h_usd=_safe_float(payload.get("volume_24h_usd")),
            fees_24h_usd=_safe_float(payload.get("fees_24h_usd")),
            apy_pct=_safe_float(payload.get("apy_pct")),
            volatility_30d_pct=_safe_float(payload.get("volatility_30d_pct")),
            peg_deviation_pct=abs(_safe_float(payload.get("peg_deviation_pct"))),
            protocol_age_days=int(_safe_float(payload.get("protocol_age_days"))),
            audited=bool(payload.get("audited", False)),
            bridge_exposed=bool(payload.get("bridge_exposed", False)),
            oracle_quality=_clamp(_safe_float(payload.get("oracle_quality"), 50.0)),
            asset_quality=_clamp(_safe_float(payload.get("asset_quality"), 50.0)),
        )


def score_liquidity_risk(snapshot: LiquidityPoolSnapshot) -> dict[str, Any]:
    """Return explainable 0..100 safety scores. Higher is safer."""

    if snapshot.tvl_usd <= 0:
        liquidity = 10.0
    elif snapshot.tvl_usd >= 50_000_000:
        liquidity = 100.0
    else:
        liquidity = 20.0 + 80.0 * (snapshot.tvl_usd / 50_000_000)

    volatility = _clamp(100.0 - snapshot.volatility_30d_pct * 0.75)
    depeg = _clamp(100.0 - snapshot.peg_deviation_pct * 25.0)
    age_score = _clamp(snapshot.protocol_age_days / 10.95)
    smart_contract = _clamp(age_score * 0.55 + (100.0 if snapshot.audited else 35.0) * 0.45)
    bridge = 35.0 if snapshot.bridge_exposed else 100.0

    components = {
        "smart_contract_score": smart_contract,
        "liquidity_score": liquidity,
        "volatility_score": volatility,
        "asset_quality_score": snapshot.asset_quality,
        "oracle_score": snapshot.oracle_quality,
        "bridge_score": bridge,
        "depeg_score": depeg,
    }
    weights = {
        "smart_contract_score": 0.22,
        "liquidity_score": 0.18,
        "volatility_score": 0.16,
        "asset_quality_score": 0.16,
        "oracle_score": 0.12,
        "bridge_score": 0.08,
        "depeg_score": 0.08,
    }
    overall = sum(components[name] * weights[name] for name in weights)

    reasons: list[str] = []
    if snapshot.tvl_usd < 1_000_000:
        reasons.append("thin_liquidity")
    if snapshot.volatility_30d_pct > 80:
        reasons.append("high_volatility")
    if snapshot.peg_deviation_pct > 1:
        reasons.append("material_peg_deviation")
    if not snapshot.audited:
        reasons.append("audit_not_confirmed")
    if snapshot.bridge_exposed:
        reasons.append("bridge_exposure")
    if snapshot.protocol_age_days < 180:
        reasons.append("young_protocol")

    return {
        **{k: round(v, 2) for k, v in components.items()},
        "overall_score": round(_clamp(overall), 2),
        "reasons": reasons,
        "scorer_version": "liquidity-risk-v1",
    }


def score_liquidity_opportunity(
    snapshot: LiquidityPoolSnapshot,
    risk_score: float,
    *,
    gas_cost_usd: float = 0.0,
    allocation_usd: float = 10_000.0,
) -> dict[str, Any]:
    """Rank an opportunity without producing or executing a transaction."""

    allocation = max(allocation_usd, 1.0)
    gas_drag_pct = max(gas_cost_usd, 0.0) / allocation * 100.0

    volume_efficiency = 0.0
    if snapshot.tvl_usd > 0:
        volume_efficiency = _clamp((snapshot.volume_24h_usd / snapshot.tvl_usd) * 100.0)

    net_apy = snapshot.apy_pct - gas_drag_pct
    eligible = net_apy > 0
    yield_score = _clamp(max(net_apy, 0.0) * 2.0)

    opportunity = (
        _clamp(risk_score) * 0.55
        + yield_score * 0.25
        + volume_efficiency * 0.20
    )
    if not eligible:
        opportunity = 0.0

    monthly_income = allocation * (net_apy / 100.0) / 12.0

    rationale: list[str] = []
    if risk_score >= 80:
        rationale.append("strong_risk_profile")
    if net_apy >= 10:
        rationale.append("meaningful_net_yield")
    if volume_efficiency >= 25:
        rationale.append("healthy_volume_efficiency")
    if gas_drag_pct >= 1:
        rationale.append("gas_drag_material")
    if not eligible:
        rationale.append("non_positive_net_apy")

    return {
        "opportunity_score": round(_clamp(opportunity), 2),
        "eligible": eligible,
        "expected_net_apy_pct": round(net_apy, 4),
        "estimated_monthly_income_usd": round(monthly_income, 2),
        "volume_efficiency_score": round(volume_efficiency, 2),
        "rationale": rationale,
        "execution_enabled": False,
    }


def rank_liquidity_opportunities(
    pools: Iterable[LiquidityPoolSnapshot],
    *,
    gas_cost_usd: float = 0.0,
    allocation_usd: float = 10_000.0,
) -> list[dict[str, Any]]:
    ranked: list[dict[str, Any]] = []
    for pool in pools:
        risk = score_liquidity_risk(pool)
        opportunity = score_liquidity_opportunity(
            pool,
            risk["overall_score"],
            gas_cost_usd=gas_cost_usd,
            allocation_usd=allocation_usd,
        )
        ranked.append(
            {
                "protocol": pool.protocol,
                "chain": pool.chain,
                "symbol": pool.symbol,
                "risk": risk,
                "opportunity": opportunity,
            }
        )

    return sorted(
        ranked,
        key=lambda row: (
            row["opportunity"]["eligible"],
            row["opportunity"]["opportunity_score"],
        ),
        reverse=True,
    )
