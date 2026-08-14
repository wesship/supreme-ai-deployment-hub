"""MoneyHub simulation-only paper execution API."""
from __future__ import annotations

import uuid
from decimal import Decimal
from typing import Any, Literal

from fastapi import APIRouter, HTTPException, Query, status
from pydantic import BaseModel, Field

from backend.auth.supabase_jwt import AuthenticatedAccess
from backend.moneyhub.router import RiskEvaluationRequest, _request, evaluate_risk

router = APIRouter(prefix="/moneyhub/paper", tags=["moneyhub-paper-engine"])


class PaperRunCreate(BaseModel):
    strategy_id: uuid.UUID
    run_type: Literal["backtest", "walk_forward", "paper", "shadow"] = "paper"
    starting_cash: Decimal = Field(gt=0)


class PaperOrderCreate(BaseModel):
    run_id: uuid.UUID
    strategy_id: uuid.UUID
    symbol: str = Field(min_length=1, max_length=64)
    asset_class: Literal["equity", "etf", "crypto", "fx", "option", "rwa", "cash", "other"]
    side: Literal["buy", "sell"]
    # This endpoint is immediate-fill simulation. Resting/trigger orders require
    # a quote-processing queue and are deliberately not advertised as executed.
    order_type: Literal["market"] = "market"
    quantity: Decimal = Field(gt=0)
    quote_price: Decimal = Field(gt=0)
    slippage_bps: Decimal = Field(default=Decimal("0"), ge=0, le=1000)
    fee: Decimal = Field(default=Decimal("0"), ge=0)
    agent_name: str | None = Field(default=None, max_length=160)
    metadata: dict[str, Any] = Field(default_factory=dict)


async def _owned_strategy(strategy_id: uuid.UUID, owner_id: str) -> dict[str, Any]:
    rows = await _request(
        "GET", "/rest/v1/moneyhub_paper_strategies",
        params={"id": f"eq.{strategy_id}", "owner_id": f"eq.{owner_id}", "select": "*", "limit": "1"},
    )
    if not isinstance(rows, list) or not rows:
        raise HTTPException(status_code=404, detail="Paper strategy not found")
    return rows[0]


async def _owned_run(run_id: uuid.UUID, owner_id: str) -> dict[str, Any]:
    rows = await _request(
        "GET", "/rest/v1/moneyhub_paper_runs",
        params={"id": f"eq.{run_id}", "owner_id": f"eq.{owner_id}", "select": "*", "limit": "1"},
    )
    if not isinstance(rows, list) or not rows:
        raise HTTPException(status_code=404, detail="Paper run not found")
    return rows[0]


async def _current_position(run_id: uuid.UUID, symbol: str, owner_id: str) -> dict[str, Any] | None:
    rows = await _request(
        "GET", "/rest/v1/moneyhub_paper_positions",
        params={
            "run_id": f"eq.{run_id}",
            "owner_id": f"eq.{owner_id}",
            "symbol": f"eq.{symbol.upper()}",
            "select": "quantity,market_value,last_price,avg_cost",
            "limit": "1",
        },
    )
    return rows[0] if isinstance(rows, list) and rows else None


@router.post("/runs", status_code=status.HTTP_201_CREATED)
async def create_paper_run(payload: PaperRunCreate, principal: AuthenticatedAccess):
    strategy = await _owned_strategy(payload.strategy_id, principal.user_id)
    if strategy.get("status") not in {"draft", "backtest", "validated", "paper", "paused"}:
        raise HTTPException(status_code=409, detail="Strategy lifecycle does not permit a simulation run")
    rows = await _request(
        "POST", "/rest/v1/moneyhub_paper_runs",
        json={
            "owner_id": principal.user_id,
            "strategy_id": str(payload.strategy_id),
            "run_type": payload.run_type,
            "status": "pending",
            "starting_cash": str(payload.starting_cash),
            "ending_cash": str(payload.starting_cash),
        },
        prefer="return=representation",
    )
    return rows[0] if isinstance(rows, list) and rows else rows


@router.post("/orders/simulate", status_code=status.HTTP_201_CREATED)
async def simulate_order(payload: PaperOrderCreate, principal: AuthenticatedAccess):
    run = await _owned_run(payload.run_id, principal.user_id)
    strategy = await _owned_strategy(payload.strategy_id, principal.user_id)
    if str(run.get("strategy_id")) != str(payload.strategy_id):
        raise HTTPException(status_code=400, detail="Run and strategy do not match")
    if run.get("status") not in {"pending", "running"}:
        raise HTTPException(status_code=409, detail="Paper run is not executable")

    symbol = payload.symbol.upper()
    current = await _current_position(payload.run_id, symbol, principal.user_id)
    current_value = Decimal(str((current or {}).get("market_value") or "0"))

    # Pre-trade risk uses a conservative simulated execution value. For buys,
    # positive slippage and fees increase capital consumed. For sells, exposure
    # can only decrease because the database executor is long-only.
    slippage_multiplier = Decimal("1") + (payload.slippage_bps / Decimal("10000"))
    simulated_gross = payload.quantity * payload.quote_price * slippage_multiplier
    risk_order_value = simulated_gross + payload.fee
    projected_position_value = (
        current_value + simulated_gross
        if payload.side == "buy"
        else max(Decimal("0"), current_value - simulated_gross)
    )

    risk = await evaluate_risk(
        RiskEvaluationRequest(
            scope_type="strategy",
            scope_key=str(payload.strategy_id),
            currency=strategy.get("base_currency") or "USD",
            order_value=risk_order_value,
            projected_position_value=projected_position_value,
            agent_name=payload.agent_name,
        ),
        principal,
    )

    risk_payload = risk.model_dump(mode="json")
    risk_payload["current_position_value"] = str(current_value)
    risk_payload["projected_position_value"] = str(projected_position_value)
    risk_payload["simulation_order_value"] = str(risk_order_value)

    if not risk.allowed:
        await _request(
            "POST", "/rest/v1/moneyhub_paper_circuit_events",
            json={
                "owner_id": principal.user_id,
                "run_id": str(payload.run_id),
                "strategy_id": str(payload.strategy_id),
                "event_type": "risk_reject",
                "reason": "; ".join(risk.reasons) or "risk policy rejected order",
                "severity": "warning",
                "snapshot": risk_payload,
            },
        )
        raise HTTPException(status_code=409, detail={"message": "Paper order rejected by risk policy", "risk": risk_payload})
    if risk.requires_approval:
        raise HTTPException(
            status_code=409,
            detail={"message": "Paper order requires approval before simulation", "risk": risk_payload},
        )

    rows = await _request(
        "POST", "/rest/v1/moneyhub_paper_orders",
        json={
            "owner_id": principal.user_id,
            "run_id": str(payload.run_id),
            "strategy_id": str(payload.strategy_id),
            "symbol": symbol,
            "asset_class": payload.asset_class,
            "side": payload.side,
            "order_type": payload.order_type,
            "quantity": str(payload.quantity),
            "limit_price": None,
            "status": "accepted",
            "risk_decision": risk_payload,
            "metadata": {**payload.metadata, "execution_mode": "simulation_only"},
        },
        prefer="return=representation",
    )
    if not isinstance(rows, list) or not rows:
        raise HTTPException(status_code=503, detail="Could not create paper order")
    order = rows[0]

    execution = await _request(
        "POST", "/rest/v1/rpc/moneyhub_paper_execute_order",
        json={
            "p_owner_id": principal.user_id,
            "p_order_id": order["id"],
            "p_quote_price": str(payload.quote_price),
            "p_slippage_bps": str(payload.slippage_bps),
            "p_fee": str(payload.fee),
        },
    )
    return {"order": order, "execution": execution, "mode": "simulation_only"}


@router.get("/positions")
async def list_positions(
    principal: AuthenticatedAccess,
    run_id: uuid.UUID | None = None,
    limit: int = Query(default=200, ge=1, le=500),
):
    params = {
        "owner_id": f"eq.{principal.user_id}",
        "select": "*",
        "order": "updated_at.desc",
        "limit": str(limit),
    }
    if run_id:
        params["run_id"] = f"eq.{run_id}"
    return await _request("GET", "/rest/v1/moneyhub_paper_positions", params=params)


@router.get("/performance")
async def list_performance(
    principal: AuthenticatedAccess,
    run_id: uuid.UUID | None = None,
    limit: int = Query(default=200, ge=1, le=500),
):
    params = {
        "owner_id": f"eq.{principal.user_id}",
        "select": "*",
        "order": "measured_at.desc",
        "limit": str(limit),
    }
    if run_id:
        params["run_id"] = f"eq.{run_id}"
    return await _request("GET", "/rest/v1/moneyhub_paper_performance", params=params)


@router.get("/circuit-events")
async def list_circuit_events(
    principal: AuthenticatedAccess,
    run_id: uuid.UUID | None = None,
    limit: int = Query(default=100, ge=1, le=500),
):
    params = {
        "owner_id": f"eq.{principal.user_id}",
        "select": "*",
        "order": "created_at.desc",
        "limit": str(limit),
    }
    if run_id:
        params["run_id"] = f"eq.{run_id}"
    return await _request("GET", "/rest/v1/moneyhub_paper_circuit_events", params=params)
