from __future__ import annotations

import asyncio
import os
from datetime import datetime, timedelta, timezone
from decimal import Decimal
from typing import Any, Literal

import httpx
from fastapi import APIRouter, HTTPException, status
from pydantic import BaseModel, Field, field_validator

from backend.auth.supabase_jwt import OCCAccess

router = APIRouter(prefix="/moneyhub")

SUPABASE_URL = os.getenv("SUPABASE_URL", "").rstrip("/")
SUPABASE_SERVICE_ROLE_KEY = os.getenv("SUPABASE_SERVICE_ROLE_KEY", "")
ECONOMIC_EVENT_RPC_PATH = "/rest/v1/rpc/moneyhub_record_economic_event"


class EconomicEventIn(BaseModel):
    kind: Literal["revenue", "cost"]
    agent_id: str
    provider: str = Field(min_length=1, max_length=80)
    provider_event_id: str = Field(min_length=1, max_length=200)
    source: str = Field(min_length=1, max_length=120)
    amount: Decimal = Field(gt=0, max_digits=14, decimal_places=2)
    currency: str = Field(default="USD", min_length=3, max_length=3)
    status: Literal["pending", "verified", "settled", "refunded", "disputed", "reversed"] = "verified"
    description: str | None = Field(default=None, max_length=1000)
    run_id: str | None = None
    metadata: dict[str, Any] = Field(default_factory=dict)
    occurred_at: datetime | None = None

    @field_validator("currency")
    @classmethod
    def normalize_currency(cls, value: str) -> str:
        normalized = value.strip().upper()
        if len(normalized) != 3 or not normalized.isalpha():
            raise ValueError("currency must be a three-letter ISO code")
        return normalized


class AgentRunStartIn(BaseModel):
    agent_id: str
    correlation_id: str = Field(min_length=1, max_length=200)
    metadata: dict[str, Any] = Field(default_factory=dict)


class AgentRunFinishIn(BaseModel):
    status: Literal["completed", "failed", "cancelled"]
    metadata: dict[str, Any] = Field(default_factory=dict)


async def _call_moneyhub_rpc(
    rpc_name: str,
    rpc_payload: dict[str, Any],
    *,
    error_scope: Literal["server operation", "ledger"] = "server operation",
) -> dict[str, Any]:
    if not SUPABASE_URL or not SUPABASE_SERVICE_ROLE_KEY:
        detail = (
            "MoneyHub economic ingestion is not configured."
            if error_scope == "ledger"
            else "MoneyHub server operations are not configured."
        )
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail=detail,
        )

    headers = {
        "apikey": SUPABASE_SERVICE_ROLE_KEY,
        "Authorization": f"Bearer {SUPABASE_SERVICE_ROLE_KEY}",
        "Content-Type": "application/json",
    }

    try:
        async with httpx.AsyncClient(timeout=8.0) as client:
            response = await client.post(
                f"{SUPABASE_URL}/rest/v1/rpc/{rpc_name}",
                headers=headers,
                json=rpc_payload,
            )
    except httpx.RequestError as exc:
        detail = (
            "MoneyHub ledger is unavailable."
            if error_scope == "ledger"
            else "MoneyHub server operation is unavailable."
        )
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail=detail,
        ) from exc

    if response.status_code >= 400:
        detail = (
            "MoneyHub economic event was rejected."
            if error_scope == "ledger"
            else "MoneyHub server operation was rejected."
        )
        try:
            body = response.json()
            if isinstance(body, dict) and isinstance(body.get("message"), str):
                detail = body["message"]
        except ValueError:
            pass
        upstream_status = (
            status.HTTP_422_UNPROCESSABLE_ENTITY
            if response.status_code in {400, 409, 422}
            else status.HTTP_502_BAD_GATEWAY
        )
        raise HTTPException(status_code=upstream_status, detail=detail)

    try:
        data = response.json()
    except ValueError as exc:
        detail = (
            "MoneyHub ledger returned an invalid response."
            if error_scope == "ledger"
            else "MoneyHub server operation returned an invalid response."
        )
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail=detail,
        ) from exc
    if not isinstance(data, dict):
        detail = (
            "MoneyHub ledger returned an invalid response."
            if error_scope == "ledger"
            else "MoneyHub server operation returned an invalid response."
        )
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail=detail,
        )
    return data


async def _get_owned_rows(
    table: Literal[
        "money_agents",
        "moneyhub_agent_runs",
        "moneyhub_revenue_events",
        "moneyhub_cost_events",
    ],
    principal: OCCAccess,
    *,
    select: str,
    filters: dict[str, str] | None = None,
) -> list[dict[str, Any]]:
    if not SUPABASE_URL or not SUPABASE_SERVICE_ROLE_KEY:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="MoneyHub intelligence is not configured.",
        )

    params = {
        "user_id": f"eq.{principal.user_id}",
        "select": select,
    }
    if filters:
        params.update(filters)

    headers = {
        "apikey": SUPABASE_SERVICE_ROLE_KEY,
        "Authorization": f"Bearer {SUPABASE_SERVICE_ROLE_KEY}",
    }

    try:
        async with httpx.AsyncClient(timeout=8.0) as client:
            response = await client.get(
                f"{SUPABASE_URL}/rest/v1/{table}",
                headers=headers,
                params=params,
            )
    except httpx.RequestError as exc:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="MoneyHub intelligence data is unavailable.",
        ) from exc

    if response.status_code >= 400:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail="MoneyHub intelligence data could not be read.",
        )

    try:
        rows = response.json()
    except ValueError as exc:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail="MoneyHub intelligence returned an invalid response.",
        ) from exc

    if not isinstance(rows, list):
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail="MoneyHub intelligence returned an invalid response.",
        )
    return [row for row in rows if isinstance(row, dict)]


def _decimal_sum(rows: list[dict[str, Any]], field: str) -> Decimal:
    total = Decimal("0")
    for row in rows:
        value = row.get(field)
        if value is None:
            continue
        try:
            total += Decimal(str(value))
        except Exception:
            continue
    return total


async def _record_event(principal: OCCAccess, payload: EconomicEventIn) -> dict[str, Any]:
    rpc_payload: dict[str, Any] = {
        "p_kind": payload.kind,
        "p_user_id": principal.user_id,
        "p_agent_id": payload.agent_id,
        "p_provider": payload.provider,
        "p_provider_event_id": payload.provider_event_id,
        "p_source": payload.source,
        "p_amount": str(payload.amount),
        "p_currency": payload.currency,
        "p_status": payload.status,
        "p_description": payload.description,
        "p_run_id": payload.run_id,
        "p_metadata": payload.metadata,
    }
    if payload.occurred_at is not None:
        rpc_payload["p_occurred_at"] = payload.occurred_at.isoformat()
    return await _call_moneyhub_rpc(
        "moneyhub_record_economic_event",
        rpc_payload,
        error_scope="ledger",
    )


@router.get("/intelligence/summary")
async def get_intelligence_summary(principal: OCCAccess) -> dict[str, Any]:
    """
    Read-only financial intelligence for Hermes and MoneyHub UI.

    This endpoint never creates transfers, brokerage orders, withdrawals, loans,
    approvals, signatures, or provider-side mutations.
    """
    since = (datetime.now(timezone.utc) - timedelta(days=30)).isoformat()

    agents, revenue_rows, cost_rows, run_rows = await asyncio.gather(
        _get_owned_rows(
            "money_agents",
            principal,
            select="id,name,total_earned,runs_count,status",
        ),
        _get_owned_rows(
            "moneyhub_revenue_events",
            principal,
            select="amount,currency,status,occurred_at,agent_id",
            filters={
                "occurred_at": f"gte.{since}",
                "status": "in.(verified,settled)",
                "currency": "eq.USD",
            },
        ),
        _get_owned_rows(
            "moneyhub_cost_events",
            principal,
            select="amount,currency,status,occurred_at,agent_id",
            filters={
                "occurred_at": f"gte.{since}",
                "status": "in.(verified,settled)",
                "currency": "eq.USD",
            },
        ),
        _get_owned_rows(
            "moneyhub_agent_runs",
            principal,
            select="id,status,started_at,finished_at,agent_id",
            filters={"started_at": f"gte.{since}"},
        ),
    )

    revenue_30d = _decimal_sum(revenue_rows, "amount")
    cost_30d = _decimal_sum(cost_rows, "amount")
    net_30d = revenue_30d - cost_30d

    total_tracked = _decimal_sum(agents, "total_earned")
    top_agent_total = max(
        (Decimal(str(agent.get("total_earned") or 0)) for agent in agents),
        default=Decimal("0"),
    )
    top_agent_share = (
        (top_agent_total / total_tracked * Decimal("100"))
        if total_tracked > 0
        else Decimal("0")
    )

    run_count_30d = len(run_rows)
    avg_revenue_per_run = (
        revenue_30d / Decimal(run_count_30d)
        if run_count_30d > 0
        else Decimal("0")
    )
    margin_pct = (
        net_30d / revenue_30d * Decimal("100")
        if revenue_30d > 0
        else Decimal("0")
    )

    signals: list[dict[str, str]] = []
    if top_agent_share >= Decimal("70") and total_tracked > 0:
        signals.append({
            "kind": "revenue_concentration",
            "severity": "watch",
            "message": "Top-agent earnings concentration is at or above the 70% review threshold.",
        })
    if cost_30d > revenue_30d and (cost_30d > 0 or revenue_30d > 0):
        signals.append({
            "kind": "negative_operating_margin",
            "severity": "watch",
            "message": "Verified 30-day costs exceed verified 30-day revenue.",
        })
    if run_count_30d < 10:
        signals.append({
            "kind": "forecast_confidence",
            "severity": "early",
            "message": "Fewer than 10 recorded runs are available in the 30-day window.",
        })
    if not signals:
        signals.append({
            "kind": "operating_baseline",
            "severity": "healthy",
            "message": "No configured MoneyHub watch threshold is currently triggered.",
        })

    return {
        "window_days": 30,
        "currency_scope": "USD-only; non-USD events require a governed FX normalization layer before aggregation",
        "metrics": {
            "revenue_30d": str(revenue_30d),
            "cost_30d": str(cost_30d),
            "net_30d": str(net_30d),
            "margin_pct": str(margin_pct.quantize(Decimal("0.01"))),
            "run_count_30d": run_count_30d,
            "avg_revenue_per_run": str(avg_revenue_per_run.quantize(Decimal("0.01"))),
            "tracked_lifetime_earnings": str(total_tracked),
            "top_agent_share_pct": str(top_agent_share.quantize(Decimal("0.01"))),
            "money_agent_count": len(agents),
        },
        "signals": signals,
        "guardrails": {
            "read_only": True,
            "custody": False,
            "brokerage_execution": False,
            "transfers": False,
            "lending_decisions": False,
        },
    }


@router.get("/intelligence/cashflow")
async def get_cashflow_intelligence(principal: OCCAccess) -> dict[str, Any]:
    """
    Read-only cash-flow intelligence derived from verified USD MoneyHub events.

    This is operational analysis only. It does not read bank balances, initiate
    transfers, submit payments, make lending decisions, or execute brokerage actions.
    """
    now = datetime.now(timezone.utc)
    since_30d = (now - timedelta(days=30)).isoformat()
    since_7d = (now - timedelta(days=7)).isoformat()

    revenue_rows, cost_rows = await asyncio.gather(
        _get_owned_rows(
            "moneyhub_revenue_events",
            principal,
            select="amount,currency,status,occurred_at,agent_id,source,provider",
            filters={
                "occurred_at": f"gte.{since_30d}",
                "status": "in.(verified,settled)",
                "currency": "eq.USD",
            },
        ),
        _get_owned_rows(
            "moneyhub_cost_events",
            principal,
            select="amount,currency,status,occurred_at,agent_id,source,provider",
            filters={
                "occurred_at": f"gte.{since_30d}",
                "status": "in.(verified,settled)",
                "currency": "eq.USD",
            },
        ),
    )

    def occurred_at(row: dict[str, Any]) -> datetime | None:
        value = row.get("occurred_at")
        if not isinstance(value, str):
            return None
        try:
            parsed = datetime.fromisoformat(value.replace("Z", "+00:00"))
            return parsed if parsed.tzinfo else parsed.replace(tzinfo=timezone.utc)
        except ValueError:
            return None

    def amount_of(row: dict[str, Any]) -> Decimal:
        try:
            return Decimal(str(row.get("amount") or 0))
        except Exception:
            return Decimal("0")

    def source_breakdown(rows: list[dict[str, Any]]) -> list[dict[str, Any]]:
        totals: dict[str, Decimal] = {}
        counts: dict[str, int] = {}
        for row in rows:
            source_name = str(row.get("source") or "unknown").strip() or "unknown"
            totals[source_name] = totals.get(source_name, Decimal("0")) + amount_of(row)
            counts[source_name] = counts.get(source_name, 0) + 1
        ranked = sorted(totals.items(), key=lambda item: item[1], reverse=True)
        return [
            {
                "source": source_name,
                "amount": str(total),
                "event_count": counts[source_name],
                "recurring_candidate": counts[source_name] >= 2,
            }
            for source_name, total in ranked[:10]
        ]

    daily: dict[str, dict[str, Decimal]] = {}
    for kind, rows in (("inflow", revenue_rows), ("outflow", cost_rows)):
        for row in rows:
            ts = occurred_at(row)
            if ts is None:
                continue
            day = ts.date().isoformat()
            bucket = daily.setdefault(day, {"inflow": Decimal("0"), "outflow": Decimal("0")})
            bucket[kind] += amount_of(row)

    daily_series = []
    for offset in range(29, -1, -1):
        day = (now.date() - timedelta(days=offset)).isoformat()
        bucket = daily.get(day, {"inflow": Decimal("0"), "outflow": Decimal("0")})
        inflow = bucket["inflow"]
        outflow = bucket["outflow"]
        daily_series.append({
            "date": day,
            "inflow": str(inflow),
            "outflow": str(outflow),
            "net": str(inflow - outflow),
        })

    revenue_30d = _decimal_sum(revenue_rows, "amount")
    cost_30d = _decimal_sum(cost_rows, "amount")
    revenue_7d = sum(
        (amount_of(row) for row in revenue_rows if (occurred_at(row) and occurred_at(row).isoformat() >= since_7d)),
        Decimal("0"),
    )
    cost_7d = sum(
        (amount_of(row) for row in cost_rows if (occurred_at(row) and occurred_at(row).isoformat() >= since_7d)),
        Decimal("0"),
    )

    net_30d = revenue_30d - cost_30d
    net_7d = revenue_7d - cost_7d
    avg_daily_net_30d = net_30d / Decimal("30")

    outflow_breakdown = source_breakdown(cost_rows)
    inflow_breakdown = source_breakdown(revenue_rows)

    signals: list[dict[str, str]] = []
    if net_7d < 0:
        signals.append({
            "kind": "negative_7d_cashflow",
            "severity": "watch",
            "message": "Verified USD outflows exceeded verified USD inflows over the last 7 days.",
        })
    if net_30d < 0:
        signals.append({
            "kind": "negative_30d_cashflow",
            "severity": "watch",
            "message": "Verified USD outflows exceeded verified USD inflows over the last 30 days.",
        })
    if outflow_breakdown and cost_30d > 0:
        largest = Decimal(outflow_breakdown[0]["amount"])
        share = largest / cost_30d * Decimal("100")
        if share >= Decimal("50"):
            signals.append({
                "kind": "outflow_concentration",
                "severity": "watch",
                "message": "The largest cost source represents at least 50% of verified 30-day USD outflows.",
            })
    if len(revenue_rows) + len(cost_rows) < 10:
        signals.append({
            "kind": "cashflow_confidence",
            "severity": "early",
            "message": "Fewer than 10 verified USD events are available in the 30-day cash-flow window.",
        })
    if not signals:
        signals.append({
            "kind": "cashflow_baseline",
            "severity": "healthy",
            "message": "No configured MoneyHub cash-flow watch threshold is currently triggered.",
        })

    return {
        "window_days": 30,
        "currency_scope": "USD-only; bank balances and non-USD events are not included",
        "metrics": {
            "inflow_7d": str(revenue_7d),
            "outflow_7d": str(cost_7d),
            "net_7d": str(net_7d),
            "inflow_30d": str(revenue_30d),
            "outflow_30d": str(cost_30d),
            "net_30d": str(net_30d),
            "avg_daily_net_30d": str(avg_daily_net_30d.quantize(Decimal("0.01"))),
            "event_count_30d": len(revenue_rows) + len(cost_rows),
        },
        "inflow_sources": inflow_breakdown,
        "outflow_sources": outflow_breakdown,
        "daily_series": daily_series,
        "signals": signals,
        "limitations": {
            "bank_balance_available": False,
            "runway_available": False,
            "pending_transactions_included": False,
            "fx_normalization_available": False,
            "recurring_detection": "candidate-only based on repeated source observations",
        },
        "guardrails": {
            "read_only": True,
            "transfers": False,
            "payments": False,
            "lending_decisions": False,
            "brokerage_execution": False,
        },
    }


@router.post("/economic-events", status_code=status.HTTP_201_CREATED)
async def record_economic_event(payload: EconomicEventIn, principal: OCCAccess) -> dict[str, Any]:
    result = await _record_event(principal, payload)
    return {
        "status": "recorded" if result.get("inserted") else "duplicate",
        "event": result,
    }


@router.post("/runs", status_code=status.HTTP_201_CREATED)
async def start_agent_run(payload: AgentRunStartIn, principal: OCCAccess) -> dict[str, Any]:
    result = await _call_moneyhub_rpc(
        "moneyhub_start_agent_run",
        {
            "p_user_id": principal.user_id,
            "p_agent_id": payload.agent_id,
            "p_correlation_id": payload.correlation_id,
            "p_metadata": payload.metadata,
        },
    )
    return {
        "status": "started" if result.get("inserted") else "duplicate",
        "run": result,
    }


@router.post("/runs/{run_id}/finish")
async def finish_agent_run(
    run_id: str,
    payload: AgentRunFinishIn,
    principal: OCCAccess,
) -> dict[str, Any]:
    result = await _call_moneyhub_rpc(
        "moneyhub_finish_agent_run",
        {
            "p_user_id": principal.user_id,
            "p_run_id": run_id,
            "p_status": payload.status,
            "p_metadata": payload.metadata,
        },
    )
    return {
        "status": "finished" if result.get("finished") else "already_finished",
        "run": result,
    }
