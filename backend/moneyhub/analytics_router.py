"""MoneyHub Agent P&L and simulation-only strategy API."""
from __future__ import annotations

from decimal import Decimal
from typing import Any, Literal

from fastapi import APIRouter, Query, status
from pydantic import BaseModel, Field, field_validator

from backend.auth.supabase_jwt import AuthenticatedAccess
from backend.moneyhub.router import _request

router = APIRouter(prefix="/moneyhub", tags=["moneyhub"])


class AttributionEventCreate(BaseModel):
    event_type: Literal[
        "revenue", "expense", "model_cost", "infrastructure_cost", "api_cost",
        "labor_cost", "commission", "fee", "refund"
    ]
    amount: Decimal = Field(ge=0)
    currency: str = Field(default="USD", min_length=3, max_length=12)
    agent_name: str | None = Field(default=None, max_length=160)
    business_unit: str | None = Field(default=None, max_length=160)
    project_ref: str | None = Field(default=None, max_length=255)
    customer_ref: str | None = Field(default=None, max_length=255)
    source_type: str = Field(default="api", min_length=1, max_length=80)
    source_ref: str | None = Field(default=None, max_length=255)
    journal_id: str | None = None
    metadata: dict[str, Any] = Field(default_factory=dict)

    @field_validator("currency")
    @classmethod
    def normalize_currency(cls, value: str) -> str:
        return value.upper()


class PaperStrategyCreate(BaseModel):
    name: str = Field(min_length=1, max_length=160)
    strategy_type: Literal[
        "trend", "mean_reversion", "rebalance", "arbitrage", "market_making",
        "ai_signal", "options", "crypto", "custom"
    ]
    version: int = Field(default=1, ge=1)
    base_currency: str = Field(default="USD", min_length=3, max_length=12)
    configuration: dict[str, Any] = Field(default_factory=dict)
    risk_profile: dict[str, Any] = Field(default_factory=dict)
    created_by_agent: str | None = Field(default=None, max_length=160)

    @field_validator("base_currency")
    @classmethod
    def normalize_currency(cls, value: str) -> str:
        return value.upper()


@router.post("/attribution-events", status_code=status.HTTP_201_CREATED)
async def create_attribution_event(payload: AttributionEventCreate, principal: AuthenticatedAccess):
    body = payload.model_dump(mode="json")
    body["amount"] = str(payload.amount)
    body["owner_id"] = principal.user_id
    rows = await _request(
        "POST",
        "/rest/v1/moneyhub_attribution_events",
        json=body,
        prefer="return=representation",
    )
    return rows[0] if isinstance(rows, list) and rows else rows


@router.get("/attribution-events")
async def list_attribution_events(
    principal: AuthenticatedAccess,
    agent_name: str | None = None,
    limit: int = Query(default=100, ge=1, le=500),
):
    params = {
        "owner_id": f"eq.{principal.user_id}",
        "select": "*",
        "order": "occurred_at.desc",
        "limit": str(limit),
    }
    if agent_name:
        params["agent_name"] = f"eq.{agent_name}"
    return await _request("GET", "/rest/v1/moneyhub_attribution_events", params=params)


@router.get("/agent-pnl")
async def list_agent_pnl(principal: AuthenticatedAccess):
    return await _request(
        "GET",
        "/rest/v1/moneyhub_agent_pnl",
        params={
            "owner_id": f"eq.{principal.user_id}",
            "select": "owner_id,agent_name,currency,revenue,costs,net_profit,first_activity_at,last_activity_at,event_count",
            "order": "net_profit.desc",
        },
    )


@router.get("/executive/agent-pnl")
async def executive_agent_pnl(
    principal: AuthenticatedAccess,
    runtime_limit: int = Query(default=100, ge=1, le=500),
):
    """Owner-scoped executive summary without mixing values across currencies."""
    agents = await list_agent_pnl(principal)
    runtime_costs = await _request(
        "GET",
        "/rest/v1/moneyhub_runtime_cost_ingestions",
        params={
            "owner_id": f"eq.{principal.user_id}",
            "select": "source_system,source_ref,agent_name,amount,currency,tokens_used,duration_ms,ingested_at",
            "order": "ingested_at.desc",
            "limit": str(runtime_limit),
        },
    )

    totals: dict[str, dict[str, Decimal | int]] = {}
    ranked: list[dict[str, Any]] = []
    for row in agents if isinstance(agents, list) else []:
        currency = str(row.get("currency") or "USD").upper()
        revenue = Decimal(str(row.get("revenue") or "0"))
        costs = Decimal(str(row.get("costs") or "0"))
        net = Decimal(str(row.get("net_profit") or "0"))
        bucket = totals.setdefault(
            currency,
            {"revenue": Decimal("0"), "costs": Decimal("0"), "net_profit": Decimal("0"), "event_count": 0},
        )
        bucket["revenue"] = Decimal(str(bucket["revenue"])) + revenue
        bucket["costs"] = Decimal(str(bucket["costs"])) + costs
        bucket["net_profit"] = Decimal(str(bucket["net_profit"])) + net
        bucket["event_count"] = int(bucket["event_count"]) + int(row.get("event_count") or 0)
        margin = (net / revenue * Decimal("100")) if revenue else None
        ranked.append({**row, "profit_margin_pct": str(margin.quantize(Decimal("0.0001"))) if margin is not None else None})

    currency_totals: dict[str, Any] = {}
    for currency, bucket in totals.items():
        revenue = Decimal(str(bucket["revenue"]))
        net = Decimal(str(bucket["net_profit"]))
        margin = (net / revenue * Decimal("100")) if revenue else None
        currency_totals[currency] = {
            "revenue": str(revenue),
            "costs": str(bucket["costs"]),
            "net_profit": str(net),
            "profit_margin_pct": str(margin.quantize(Decimal("0.0001"))) if margin is not None else None,
            "event_count": int(bucket["event_count"]),
        }

    ranked.sort(key=lambda item: Decimal(str(item.get("net_profit") or "0")), reverse=True)
    return {
        "currency_totals": currency_totals,
        "agents": ranked,
        "recent_runtime_costs": runtime_costs if isinstance(runtime_costs, list) else [],
        "currency_mixing_disabled": True,
    }


@router.post("/paper/strategies", status_code=status.HTTP_201_CREATED)
async def create_paper_strategy(payload: PaperStrategyCreate, principal: AuthenticatedAccess):
    rows = await _request(
        "POST", "/rest/v1/moneyhub_paper_strategies",
        json={"owner_id": principal.user_id, "status": "draft", **payload.model_dump(mode="json")},
        prefer="return=representation",
    )
    return rows[0] if isinstance(rows, list) and rows else rows


@router.get("/paper/strategies")
async def list_paper_strategies(principal: AuthenticatedAccess):
    return await _request(
        "GET", "/rest/v1/moneyhub_paper_strategies",
        params={"owner_id": f"eq.{principal.user_id}", "select": "*", "order": "updated_at.desc"},
    )


@router.get("/paper/runs")
async def list_paper_runs(principal: AuthenticatedAccess, limit: int = Query(default=100, ge=1, le=500)):
    return await _request(
        "GET", "/rest/v1/moneyhub_paper_runs",
        params={"owner_id": f"eq.{principal.user_id}", "select": "*", "order": "created_at.desc", "limit": str(limit)},
    )


@router.get("/paper/orders")
async def list_paper_orders(principal: AuthenticatedAccess, limit: int = Query(default=100, ge=1, le=500)):
    return await _request(
        "GET", "/rest/v1/moneyhub_paper_orders",
        params={"owner_id": f"eq.{principal.user_id}", "select": "*", "order": "submitted_at.desc", "limit": str(limit)},
    )


@router.get("/paper/health")
async def paper_trading_health():
    return {
        "status": "ok",
        "mode": "simulation_only",
        "broker_execution_enabled": False,
        "withdrawals_enabled": False,
        "promotion_path": ["backtest", "walk_forward", "paper", "shadow"],
    }
