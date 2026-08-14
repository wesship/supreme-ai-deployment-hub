"""Governed MoneyHub API.

All financial ownership is derived from a verified Supabase access token.
The browser never supplies owner_id. Mutations use the backend service role
against narrowly defined database RPC/table surfaces.
"""
from __future__ import annotations

import os
import uuid
from decimal import Decimal
from typing import Any, Literal

import httpx
from fastapi import APIRouter, HTTPException, Query, status
from pydantic import BaseModel, Field, field_validator

from backend.auth.supabase_jwt import AuthenticatedAccess

router = APIRouter(prefix="/moneyhub", tags=["moneyhub"])

SUPABASE_URL = os.getenv("SUPABASE_URL", "").rstrip("/")
SUPABASE_SERVICE_ROLE_KEY = os.getenv("SUPABASE_SERVICE_ROLE_KEY", "")


def _service_headers(prefer: str | None = None) -> dict[str, str]:
    if not SUPABASE_URL or not SUPABASE_SERVICE_ROLE_KEY:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="MoneyHub data service is not configured.",
        )
    headers = {
        "apikey": SUPABASE_SERVICE_ROLE_KEY,
        "Authorization": f"Bearer {SUPABASE_SERVICE_ROLE_KEY}",
        "Content-Type": "application/json",
    }
    if prefer:
        headers["Prefer"] = prefer
    return headers


async def _request(
    method: str,
    path: str,
    *,
    params: dict[str, str] | None = None,
    json: Any = None,
    prefer: str | None = None,
) -> Any:
    try:
        async with httpx.AsyncClient(timeout=8.0) as client:
            response = await client.request(
                method,
                f"{SUPABASE_URL}{path}",
                headers=_service_headers(prefer),
                params=params,
                json=json,
            )
    except httpx.RequestError as exc:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="MoneyHub data service is unavailable.",
        ) from exc

    if response.status_code >= 400:
        detail = "MoneyHub operation failed."
        try:
            body = response.json()
            if isinstance(body, dict) and isinstance(body.get("message"), str):
                detail = body["message"]
        except ValueError:
            pass
        raise HTTPException(status_code=400 if response.status_code < 500 else 503, detail=detail)

    if not response.content:
        return None
    return response.json()


class AccountCreate(BaseModel):
    code: str = Field(min_length=1, max_length=64)
    name: str = Field(min_length=1, max_length=160)
    account_type: Literal["asset", "liability", "equity", "revenue", "expense"]
    normal_balance: Literal["debit", "credit"]
    currency: str = Field(default="USD", min_length=3, max_length=12)
    agent_name: str | None = Field(default=None, max_length=160)
    business_unit: str | None = Field(default=None, max_length=160)
    external_ref: str | None = Field(default=None, max_length=255)
    metadata: dict[str, Any] = Field(default_factory=dict)

    @field_validator("currency")
    @classmethod
    def normalize_currency(cls, value: str) -> str:
        return value.upper()


class JournalEntry(BaseModel):
    account_id: uuid.UUID
    direction: Literal["debit", "credit"]
    amount: Decimal = Field(gt=0)
    memo: str | None = Field(default=None, max_length=500)
    agent_name: str | None = Field(default=None, max_length=160)
    project_ref: str | None = Field(default=None, max_length=255)
    metadata: dict[str, Any] = Field(default_factory=dict)


class JournalCreate(BaseModel):
    idempotency_key: str = Field(min_length=1, max_length=255)
    description: str = Field(min_length=1, max_length=500)
    currency: str = Field(default="USD", min_length=3, max_length=12)
    entries: list[JournalEntry] = Field(min_length=2)
    source_type: str = Field(default="api", min_length=1, max_length=80)
    source_ref: str | None = Field(default=None, max_length=255)
    agent_name: str | None = Field(default=None, max_length=160)
    correlation_id: str | None = Field(default=None, max_length=255)
    metadata: dict[str, Any] = Field(default_factory=dict)

    @field_validator("currency")
    @classmethod
    def normalize_currency(cls, value: str) -> str:
        return value.upper()


class JournalReverse(BaseModel):
    idempotency_key: str = Field(min_length=1, max_length=255)
    description: str | None = Field(default=None, max_length=500)
    correlation_id: str | None = Field(default=None, max_length=255)


class RiskEvaluationRequest(BaseModel):
    scope_type: Literal["global", "agent", "strategy", "account", "asset", "business_unit"] = "global"
    scope_key: str = Field(default="global", min_length=1, max_length=255)
    currency: str = Field(default="USD", min_length=3, max_length=12)
    order_value: Decimal = Field(gt=0)
    projected_position_value: Decimal | None = Field(default=None, ge=0)
    realized_daily_loss: Decimal = Field(default=Decimal("0"), ge=0)
    current_drawdown_pct: Decimal = Field(default=Decimal("0"), ge=0, le=100)
    agent_name: str | None = Field(default=None, max_length=160)

    @field_validator("currency")
    @classmethod
    def normalize_currency(cls, value: str) -> str:
        return value.upper()


class RiskEvaluationResponse(BaseModel):
    allowed: bool
    requires_approval: bool
    reasons: list[str]
    matched_limits: list[dict[str, Any]]


@router.get("/accounts")
async def list_accounts(principal: AuthenticatedAccess, active_only: bool = True):
    params = {
        "owner_id": f"eq.{principal.user_id}",
        "select": "id,code,name,account_type,normal_balance,currency,agent_name,business_unit,external_ref,active,metadata,created_at,updated_at",
        "order": "code.asc",
    }
    if active_only:
        params["active"] = "eq.true"
    return await _request("GET", "/rest/v1/moneyhub_accounts", params=params)


@router.post("/accounts", status_code=status.HTTP_201_CREATED)
async def create_account(payload: AccountCreate, principal: AuthenticatedAccess):
    rows = await _request(
        "POST",
        "/rest/v1/moneyhub_accounts",
        json={"owner_id": principal.user_id, **payload.model_dump()},
        prefer="return=representation",
    )
    return rows[0] if isinstance(rows, list) and rows else rows


@router.get("/balances")
async def list_balances(principal: AuthenticatedAccess):
    return await _request(
        "GET",
        "/rest/v1/moneyhub_account_balances",
        params={
            "owner_id": f"eq.{principal.user_id}",
            "select": "account_id,code,name,account_type,normal_balance,currency,agent_name,balance",
            "order": "code.asc",
        },
    )


@router.get("/journals")
async def list_journals(
    principal: AuthenticatedAccess,
    limit: int = Query(default=50, ge=1, le=200),
):
    return await _request(
        "GET",
        "/rest/v1/moneyhub_journals",
        params={
            "owner_id": f"eq.{principal.user_id}",
            "select": "id,idempotency_key,status,currency,description,source_type,source_ref,agent_name,correlation_id,occurred_at,posted_at,metadata,created_at",
            "order": "occurred_at.desc",
            "limit": str(limit),
        },
    )


@router.post("/journals", status_code=status.HTTP_201_CREATED)
async def post_journal(payload: JournalCreate, principal: AuthenticatedAccess):
    rpc_payload = {
        "p_owner_id": principal.user_id,
        "p_idempotency_key": payload.idempotency_key,
        "p_description": payload.description,
        "p_currency": payload.currency,
        "p_entries": [
            {
                **entry.model_dump(mode="json"),
                "amount": str(entry.amount),
            }
            for entry in payload.entries
        ],
        "p_source_type": payload.source_type,
        "p_source_ref": payload.source_ref,
        "p_agent_name": payload.agent_name,
        "p_correlation_id": payload.correlation_id,
        "p_metadata": payload.metadata,
    }
    journal_id = await _request("POST", "/rest/v1/rpc/moneyhub_post_journal", json=rpc_payload)
    return {"journal_id": journal_id, "status": "posted"}


@router.post("/journals/{journal_id}/reverse", status_code=status.HTTP_201_CREATED)
async def reverse_journal(
    journal_id: uuid.UUID,
    payload: JournalReverse,
    principal: AuthenticatedAccess,
):
    reversal_id = await _request(
        "POST",
        "/rest/v1/rpc/moneyhub_reverse_journal",
        json={
            "p_owner_id": principal.user_id,
            "p_original_journal_id": str(journal_id),
            "p_idempotency_key": payload.idempotency_key,
            "p_description": payload.description,
            "p_correlation_id": payload.correlation_id,
        },
    )
    return {"journal_id": reversal_id, "status": "posted", "reverses": str(journal_id)}


@router.get("/agent-budgets")
async def list_agent_budgets(principal: AuthenticatedAccess):
    return await _request(
        "GET",
        "/rest/v1/moneyhub_agent_budgets",
        params={
            "owner_id": f"eq.{principal.user_id}",
            "select": "*",
            "order": "agent_name.asc,currency.asc",
        },
    )


@router.get("/risk-limits")
async def list_risk_limits(principal: AuthenticatedAccess):
    return await _request(
        "GET",
        "/rest/v1/moneyhub_risk_limits",
        params={
            "owner_id": f"eq.{principal.user_id}",
            "select": "*",
            "order": "scope_type.asc,scope_key.asc,currency.asc",
        },
    )


@router.post("/risk/evaluate", response_model=RiskEvaluationResponse)
async def evaluate_risk(payload: RiskEvaluationRequest, principal: AuthenticatedAccess):
    filters = [
        f"and(owner_id.eq.{principal.user_id},scope_type.eq.global,scope_key.eq.global,currency.eq.{payload.currency})",
        f"and(owner_id.eq.{principal.user_id},scope_type.eq.{payload.scope_type},scope_key.eq.{payload.scope_key},currency.eq.{payload.currency})",
    ]
    rows = await _request(
        "GET",
        "/rest/v1/moneyhub_risk_limits",
        params={
            "or": f"({','.join(filters)})",
            "active": "eq.true",
            "select": "scope_type,scope_key,currency,max_position_value,max_order_value,daily_loss_limit,max_drawdown_pct,requires_approval_over,kill_switch",
        },
    )
    if not isinstance(rows, list):
        rows = []

    reasons: list[str] = []
    requires_approval = False
    for row in rows:
        if row.get("kill_switch") is True:
            reasons.append(f"kill switch enabled for {row.get('scope_type')}:{row.get('scope_key')}")
        max_order = row.get("max_order_value")
        if max_order is not None and payload.order_value > Decimal(str(max_order)):
            reasons.append(f"order value exceeds {row.get('scope_type')} max_order_value")
        max_position = row.get("max_position_value")
        if (
            max_position is not None
            and payload.projected_position_value is not None
            and payload.projected_position_value > Decimal(str(max_position))
        ):
            reasons.append(f"projected position exceeds {row.get('scope_type')} max_position_value")
        daily_loss = row.get("daily_loss_limit")
        if daily_loss is not None and payload.realized_daily_loss >= Decimal(str(daily_loss)):
            reasons.append(f"daily loss limit reached for {row.get('scope_type')} scope")
        drawdown = row.get("max_drawdown_pct")
        if drawdown is not None and payload.current_drawdown_pct >= Decimal(str(drawdown)):
            reasons.append(f"maximum drawdown reached for {row.get('scope_type')} scope")
        approval = row.get("requires_approval_over")
        if approval is not None and payload.order_value >= Decimal(str(approval)):
            requires_approval = True

    if payload.agent_name:
        budgets = await _request(
            "GET",
            "/rest/v1/moneyhub_agent_budgets",
            params={
                "owner_id": f"eq.{principal.user_id}",
                "agent_name": f"eq.{payload.agent_name}",
                "currency": f"eq.{payload.currency}",
                "active": "eq.true",
                "select": "agent_name,currency,per_transaction_limit,requires_approval_over",
                "limit": "1",
            },
        )
        if isinstance(budgets, list) and budgets:
            budget = budgets[0]
            per_tx = budget.get("per_transaction_limit")
            if per_tx is not None and payload.order_value > Decimal(str(per_tx)):
                reasons.append("order value exceeds agent per-transaction budget")
            approval = budget.get("requires_approval_over")
            if approval is not None and payload.order_value >= Decimal(str(approval)):
                requires_approval = True

    return RiskEvaluationResponse(
        allowed=len(reasons) == 0,
        requires_approval=requires_approval,
        reasons=reasons,
        matched_limits=rows,
    )


@router.get("/health")
async def moneyhub_health():
    return {
        "status": "ok",
        "component": "moneyhub",
        "live_trading_enabled": False,
        "execution_mode": "ledger_and_policy_only",
    }
