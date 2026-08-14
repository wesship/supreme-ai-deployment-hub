"""MoneyHub governed simulation market-data and promotion API."""
from __future__ import annotations

import uuid
from datetime import datetime, timezone
from decimal import Decimal
from typing import Any, Literal

from fastapi import APIRouter, HTTPException, Query, status
from pydantic import BaseModel, Field

from backend.auth.supabase_jwt import AuthenticatedAccess
from backend.moneyhub.router import _request

router = APIRouter(prefix="/moneyhub/paper", tags=["moneyhub-paper-market"])


class ManualQuote(BaseModel):
    symbol: str = Field(min_length=1, max_length=64)
    asset_class: Literal["equity", "etf", "crypto", "fx", "option", "rwa", "cash", "other"] = "other"
    price: Decimal = Field(gt=0)
    bid: Decimal | None = Field(default=None, gt=0)
    ask: Decimal | None = Field(default=None, gt=0)
    observed_at: datetime | None = None
    source_ref: str | None = Field(default=None, max_length=255)
    metadata: dict[str, Any] = Field(default_factory=dict)


class ManualMarketDataIngest(BaseModel):
    provider: str = Field(default="manual", min_length=1, max_length=120)
    quotes: list[ManualQuote] = Field(min_length=1, max_length=500)


class PromotionPolicyUpsert(BaseModel):
    from_stage: Literal["backtest", "walk_forward", "paper"]
    to_stage: Literal["walk_forward", "paper", "shadow"]
    min_snapshots: int = Field(default=20, ge=1, le=100000)
    min_trades: int = Field(default=10, ge=0, le=1000000)
    min_return_pct: Decimal = Decimal("0")
    max_drawdown_pct: Decimal = Field(default=Decimal("10"), ge=0, le=100)
    min_score: Decimal = Decimal("0")
    require_completed_run: bool = True
    active: bool = True


_TRANSITIONS = {
    "backtest": "walk_forward",
    "walk_forward": "paper",
    "paper": "shadow",
}


def _parse_utc(value: str) -> datetime:
    parsed = datetime.fromisoformat(value.replace("Z", "+00:00"))
    if parsed.tzinfo is None:
        parsed = parsed.replace(tzinfo=timezone.utc)
    return parsed.astimezone(timezone.utc)


@router.post("/market-data/manual", status_code=status.HTTP_201_CREATED)
async def ingest_manual_market_data(payload: ManualMarketDataIngest, principal: AuthenticatedAccess):
    for quote in payload.quotes:
        if quote.bid is not None and quote.ask is not None and quote.ask < quote.bid:
            raise HTTPException(status_code=422, detail=f"ask must be >= bid for {quote.symbol}")

    return await _request(
        "POST",
        "/rest/v1/rpc/moneyhub_ingest_market_quotes",
        json={
            "p_owner_id": principal.user_id,
            "p_provider": payload.provider,
            "p_trust_tier": "manual_simulation",
            "p_quotes": [
                {
                    "symbol": q.symbol.upper(),
                    "asset_class": q.asset_class,
                    "price": str(q.price),
                    "bid": str(q.bid) if q.bid is not None else None,
                    "ask": str(q.ask) if q.ask is not None else None,
                    "observed_at": (q.observed_at or datetime.now(timezone.utc)).isoformat(),
                    "source_ref": q.source_ref,
                    "metadata": q.metadata,
                }
                for q in payload.quotes
            ],
        },
    )


@router.get("/market-data")
async def list_market_data(
    principal: AuthenticatedAccess,
    symbol: str | None = None,
    provider: str | None = None,
    limit: int = Query(default=100, ge=1, le=500),
):
    params = {
        "owner_id": f"eq.{principal.user_id}",
        "select": "id,provider,trust_tier,symbol,asset_class,price,bid,ask,observed_at,received_at,source_ref,metadata",
        "order": "observed_at.desc",
        "limit": str(limit),
    }
    if symbol:
        params["symbol"] = f"eq.{symbol.upper()}"
    if provider:
        params["provider"] = f"eq.{provider}"
    return await _request("GET", "/rest/v1/moneyhub_market_quotes", params=params)


@router.post("/runs/{run_id}/mark-from-market-data")
async def mark_run_from_market_data(
    run_id: uuid.UUID,
    principal: AuthenticatedAccess,
    max_age_seconds: int = Query(default=300, ge=1, le=86400),
):
    positions = await _request(
        "GET",
        "/rest/v1/moneyhub_paper_positions",
        params={
            "run_id": f"eq.{run_id}",
            "owner_id": f"eq.{principal.user_id}",
            "quantity": "gt.0",
            "select": "symbol",
            "limit": "500",
        },
    )
    if not isinstance(positions, list):
        raise HTTPException(status_code=503, detail="Could not read simulated positions")
    if not positions:
        return {"mark_to_market": {"updated_positions": 0, "mode": "simulation_only"}, "quotes_used": []}

    now = datetime.now(timezone.utc)
    quotes: list[dict[str, str]] = []
    quote_audit: list[dict[str, Any]] = []
    missing: list[str] = []

    for position in positions:
        symbol = str(position["symbol"]).upper()
        rows = await _request(
            "GET",
            "/rest/v1/moneyhub_market_quotes",
            params={
                "owner_id": f"eq.{principal.user_id}",
                "symbol": f"eq.{symbol}",
                "select": "id,provider,trust_tier,symbol,price,observed_at",
                "order": "observed_at.desc",
                "limit": "1",
            },
        )
        if not isinstance(rows, list) or not rows:
            missing.append(symbol)
            continue
        quote = rows[0]
        observed = _parse_utc(str(quote["observed_at"]))
        age = (now - observed).total_seconds()
        if age < -300 or age > max_age_seconds:
            missing.append(symbol)
            continue
        quotes.append({"symbol": symbol, "price": str(quote["price"])})
        quote_audit.append(
            {
                "quote_id": quote["id"],
                "symbol": symbol,
                "provider": quote["provider"],
                "trust_tier": quote["trust_tier"],
                "observed_at": quote["observed_at"],
            }
        )

    if missing:
        raise HTTPException(
            status_code=409,
            detail={"message": "Fresh market data required for every open position", "symbols": sorted(set(missing))},
        )

    marked = await _request(
        "POST",
        "/rest/v1/rpc/moneyhub_paper_mark_to_market",
        json={"p_owner_id": principal.user_id, "p_run_id": str(run_id), "p_quotes": quotes},
    )
    snapshot = await _request(
        "POST",
        "/rest/v1/rpc/moneyhub_paper_snapshot",
        json={"p_owner_id": principal.user_id, "p_run_id": str(run_id)},
    )
    return {"mark_to_market": marked, "performance": snapshot, "quotes_used": quote_audit, "mode": "simulation_only"}


@router.post("/runs/{run_id}/complete")
async def complete_simulation_run(run_id: uuid.UUID, principal: AuthenticatedAccess):
    rows = await _request(
        "GET",
        "/rest/v1/moneyhub_paper_runs",
        params={
            "id": f"eq.{run_id}",
            "owner_id": f"eq.{principal.user_id}",
            "select": "id,status,run_type,strategy_id",
            "limit": "1",
        },
    )
    if not isinstance(rows, list) or not rows:
        raise HTTPException(status_code=404, detail="Paper run not found")
    run = rows[0]
    if run.get("status") not in {"pending", "running"}:
        raise HTTPException(status_code=409, detail="Only pending or running simulation runs can be completed")

    pending = await _request(
        "GET",
        "/rest/v1/moneyhub_paper_orders",
        params={
            "run_id": f"eq.{run_id}",
            "owner_id": f"eq.{principal.user_id}",
            "status": "in.(pending,accepted,partially_filled)",
            "select": "id",
            "limit": "1",
        },
    )
    if isinstance(pending, list) and pending:
        raise HTTPException(status_code=409, detail="Run has unresolved simulated orders")

    snapshot = await _request(
        "POST",
        "/rest/v1/rpc/moneyhub_paper_snapshot",
        json={"p_owner_id": principal.user_id, "p_run_id": str(run_id)},
    )
    if isinstance(snapshot, dict) and snapshot.get("paused"):
        raise HTTPException(
            status_code=409,
            detail={"message": "Circuit breaker paused the run; completion is blocked", "performance": snapshot},
        )

    updated = await _request(
        "PATCH",
        "/rest/v1/moneyhub_paper_runs",
        params={"id": f"eq.{run_id}", "owner_id": f"eq.{principal.user_id}", "status": "in.(pending,running)"},
        json={"status": "completed", "ended_at": datetime.now(timezone.utc).isoformat()},
        prefer="return=representation",
    )
    if not isinstance(updated, list) or not updated:
        raise HTTPException(status_code=409, detail="Run changed state before completion")
    return updated[0]


@router.post("/promotion-policies", status_code=status.HTTP_200_OK)
async def upsert_promotion_policy(payload: PromotionPolicyUpsert, principal: AuthenticatedAccess):
    expected = _TRANSITIONS[payload.from_stage]
    if payload.to_stage != expected:
        raise HTTPException(status_code=422, detail=f"{payload.from_stage} can only promote to {expected}")

    body = payload.model_dump(mode="json")
    body.update(
        {
            "owner_id": principal.user_id,
            "min_return_pct": str(payload.min_return_pct),
            "max_drawdown_pct": str(payload.max_drawdown_pct),
            "min_score": str(payload.min_score),
        }
    )
    rows = await _request(
        "POST",
        "/rest/v1/moneyhub_promotion_policies",
        params={"on_conflict": "owner_id,from_stage,to_stage"},
        json=body,
        prefer="resolution=merge-duplicates,return=representation",
    )
    return rows[0] if isinstance(rows, list) and rows else rows


@router.get("/promotion-policies")
async def list_promotion_policies(principal: AuthenticatedAccess):
    return await _request(
        "GET",
        "/rest/v1/moneyhub_promotion_policies",
        params={
            "owner_id": f"eq.{principal.user_id}",
            "select": "*",
            "order": "from_stage.asc",
        },
    )


@router.post("/strategies/{strategy_id}/runs/{run_id}/evaluate-promotion")
async def evaluate_strategy_promotion(
    strategy_id: uuid.UUID,
    run_id: uuid.UUID,
    principal: AuthenticatedAccess,
):
    return await _request(
        "POST",
        "/rest/v1/rpc/moneyhub_evaluate_strategy_promotion",
        json={
            "p_owner_id": principal.user_id,
            "p_strategy_id": str(strategy_id),
            "p_run_id": str(run_id),
        },
    )


@router.get("/promotion-evaluations")
async def list_promotion_evaluations(
    principal: AuthenticatedAccess,
    strategy_id: uuid.UUID | None = None,
    limit: int = Query(default=100, ge=1, le=500),
):
    params = {
        "owner_id": f"eq.{principal.user_id}",
        "select": "*",
        "order": "evaluated_at.desc",
        "limit": str(limit),
    }
    if strategy_id:
        params["strategy_id"] = f"eq.{strategy_id}"
    return await _request("GET", "/rest/v1/moneyhub_promotion_evaluations", params=params)
