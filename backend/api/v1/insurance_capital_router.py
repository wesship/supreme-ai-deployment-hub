"""Read-only Insurance Capital Intelligence API.

No endpoint in this router can place an order, transfer funds, or alter custody.
"""
from __future__ import annotations

from datetime import date

from fastapi import APIRouter, HTTPException

from backend.insurance_capital.analytics import BondInputs, approximate_ytm, concentration, current_yield, years_to_maturity
from backend.insurance_capital.models import PortfolioRequest, SecurityAnalysis, SecurityRecord

router = APIRouter(prefix="/insurance-capital", tags=["insurance-capital"])


@router.get("/health")
def insurance_capital_health() -> dict[str, object]:
    return {"status": "ok", "mode": "research_only", "trade_execution": False}


@router.post("/analyze-security", response_model=SecurityAnalysis)
def analyze_security(record: SecurityRecord) -> SecurityAnalysis:
    limitations: list[str] = []
    cy = None
    ytm = None
    years = None
    if record.maturity_date:
        years = years_to_maturity(record.maturity_date, date.today())
    else:
        limitations.append("maturity_date unavailable")

    if record.coupon_rate is not None and record.clean_price is not None:
        cy = current_yield(100.0, record.coupon_rate, record.clean_price)
        if record.maturity_date and years is not None:
            ytm = approximate_ytm(BondInputs(100.0, record.coupon_rate, record.clean_price, record.maturity_date, date.today()))
            limitations.append("YTM is an approximation and must not be represented as an executable quote")
    else:
        limitations.append("coupon_rate and/or clean_price unavailable")

    if not record.evidence:
        limitations.append("no source evidence supplied; material facts are unverified")

    return SecurityAnalysis(
        identifier=record.identifier,
        current_yield=cy,
        approximate_ytm=ytm,
        years_to_maturity=years,
        evidence=record.evidence,
        limitations=limitations,
    )


@router.post("/portfolio/concentration")
def portfolio_concentration(request: PortfolioRequest) -> dict[str, object]:
    buckets = {position.bucket for position in request.positions}
    if len(buckets) > 1:
        raise HTTPException(
            status_code=422,
            detail="capital buckets cannot be silently commingled; analyze each ledger separately",
        )
    issuer = concentration((p.security.issuer_name, p.market_value) for p in request.positions)
    return {
        "portfolio_id": request.portfolio_id,
        "bucket": next(iter(buckets)).value if buckets else None,
        "issuer_concentration": issuer,
        "trade_execution": False,
    }
