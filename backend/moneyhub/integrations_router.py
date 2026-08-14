"""Server-side MoneyHub integrations.

External provider locations, credentials, and trust tier are configuration-only.
Hermes financial attribution is internal-key protected and idempotent in SQL.
No brokerage, custody, order routing, or withdrawals are implemented here.
"""
from __future__ import annotations

import os
import uuid
from decimal import Decimal, InvalidOperation
from typing import Any
from urllib.parse import urlencode, urlparse

import httpx
from fastapi import APIRouter, Header, HTTPException, Query, status
from pydantic import BaseModel, Field

from backend.auth.supabase_jwt import AuthenticatedAccess
from backend.moneyhub.router import _request

router = APIRouter(prefix="/moneyhub", tags=["moneyhub-integrations"])

MARKET_DATA_URL = os.getenv("MONEYHUB_MARKET_DATA_URL", "").strip()
MARKET_DATA_API_KEY = os.getenv("MONEYHUB_MARKET_DATA_API_KEY", "").strip()
MARKET_DATA_PROVIDER = os.getenv("MONEYHUB_MARKET_DATA_PROVIDER", "external_provider").strip() or "external_provider"
MARKET_DATA_TRUST_TIER = os.getenv("MONEYHUB_MARKET_DATA_TRUST_TIER", "provider_simulation").strip()
MONEYHUB_INTERNAL_INGEST_KEY = os.getenv("MONEYHUB_INTERNAL_INGEST_KEY", "").strip()

_ALLOWED_TRUST_TIERS = {"provider_simulation", "verified_provider"}
_ALLOWED_ASSET_CLASSES = {"equity", "etf", "crypto", "fx", "option", "rwa", "cash", "other"}


class HermesRuntimeCostSync(BaseModel):
    owner_id: uuid.UUID
    currency: str = Field(default="USD", min_length=3, max_length=12)


class ProviderSyncResponse(BaseModel):
    provider: str
    trust_tier: str
    symbols: list[str]
    ingested: int
    mode: str = "simulation_only"


def _require_internal_key(value: str | None) -> None:
    if not MONEYHUB_INTERNAL_INGEST_KEY:
        raise HTTPException(status_code=503, detail="MoneyHub internal ingestion is not configured")
    if value != MONEYHUB_INTERNAL_INGEST_KEY:
        raise HTTPException(status_code=401, detail="Invalid MoneyHub internal ingestion key")


def _provider_config() -> tuple[str, str]:
    if not MARKET_DATA_URL:
        raise HTTPException(status_code=503, detail="MoneyHub market-data provider is not configured")
    parsed = urlparse(MARKET_DATA_URL)
    if parsed.scheme != "https" or not parsed.hostname:
        raise HTTPException(status_code=503, detail="MoneyHub market-data URL must be an HTTPS endpoint")
    trust = MARKET_DATA_TRUST_TIER if MARKET_DATA_TRUST_TIER in _ALLOWED_TRUST_TIERS else "provider_simulation"
    return MARKET_DATA_URL, trust


def _extract_quotes(payload: Any) -> list[dict[str, Any]]:
    if isinstance(payload, list):
        rows = payload
    elif isinstance(payload, dict) and isinstance(payload.get("quotes"), list):
        rows = payload["quotes"]
    elif isinstance(payload, dict) and isinstance(payload.get("data"), list):
        rows = payload["data"]
    else:
        raise HTTPException(status_code=502, detail="Market-data provider returned an unsupported quote shape")

    normalized: list[dict[str, Any]] = []
    for row in rows:
        if not isinstance(row, dict):
            continue
        symbol = str(row.get("symbol") or row.get("ticker") or "").strip().upper()
        raw_price = row.get("price", row.get("last", row.get("close")))
        if not symbol or raw_price is None:
            continue
        try:
            price = Decimal(str(raw_price))
        except (InvalidOperation, ValueError):
            continue
        if price <= 0:
            continue
        asset_class = str(row.get("asset_class") or "other").strip().lower()
        if asset_class not in _ALLOWED_ASSET_CLASSES:
            asset_class = "other"
        bid = row.get("bid")
        ask = row.get("ask")
        normalized.append(
            {
                "symbol": symbol,
                "asset_class": asset_class,
                "price": str(price),
                "bid": str(bid) if bid is not None else None,
                "ask": str(ask) if ask is not None else None,
                "observed_at": row.get("observed_at") or row.get("timestamp") or row.get("as_of"),
                "source_ref": str(row.get("source_ref") or row.get("id") or "") or None,
                "metadata": {"provider_payload": {k: v for k, v in row.items() if k not in {"api_key", "token", "secret"}}},
            }
        )
    return normalized


@router.post("/paper/market-data/provider/sync", response_model=ProviderSyncResponse)
async def sync_provider_market_data(
    principal: AuthenticatedAccess,
    symbols: list[str] = Query(min_length=1, max_length=100),
):
    """Fetch quote data from a fixed server-configured provider and store it for simulation/shadow valuation."""
    base_url, trust_tier = _provider_config()
    normalized_symbols = sorted({s.strip().upper() for s in symbols if s.strip()})
    if not normalized_symbols:
        raise HTTPException(status_code=422, detail="At least one symbol is required")

    separator = "&" if "?" in base_url else "?"
    url = f"{base_url}{separator}{urlencode({'symbols': ','.join(normalized_symbols)})}"
    headers = {"Accept": "application/json"}
    if MARKET_DATA_API_KEY:
        headers["Authorization"] = f"Bearer {MARKET_DATA_API_KEY}"

    try:
        async with httpx.AsyncClient(timeout=8.0, follow_redirects=False) as client:
            response = await client.get(url, headers=headers)
    except httpx.RequestError as exc:
        raise HTTPException(status_code=503, detail="Market-data provider is unavailable") from exc
    if response.status_code >= 400:
        raise HTTPException(status_code=502, detail="Market-data provider request failed")
    try:
        quotes = _extract_quotes(response.json())
    except ValueError as exc:
        raise HTTPException(status_code=502, detail="Market-data provider returned invalid JSON") from exc

    requested = set(normalized_symbols)
    quotes = [q for q in quotes if q["symbol"] in requested]
    if not quotes:
        raise HTTPException(status_code=502, detail="Market-data provider returned no usable requested quotes")

    result = await _request(
        "POST",
        "/rest/v1/rpc/moneyhub_ingest_market_quotes",
        json={
            "p_owner_id": principal.user_id,
            "p_provider": MARKET_DATA_PROVIDER,
            "p_trust_tier": trust_tier,
            "p_quotes": quotes,
        },
    )
    count = int((result or {}).get("ingested", len(quotes))) if isinstance(result, dict) else len(quotes)
    return ProviderSyncResponse(
        provider=MARKET_DATA_PROVIDER,
        trust_tier=trust_tier,
        symbols=sorted({q["symbol"] for q in quotes}),
        ingested=count,
    )


@router.post("/internal/hermes/runs/{run_id}/sync-cost", status_code=status.HTTP_200_OK)
async def sync_hermes_runtime_cost(
    run_id: uuid.UUID,
    payload: HermesRuntimeCostSync,
    x_moneyhub_internal_key: str | None = Header(default=None, alias="X-MoneyHub-Internal-Key"),
):
    """Import one Hermes run's recorded cost into MoneyHub exactly once."""
    _require_internal_key(x_moneyhub_internal_key)
    rows = await _request(
        "GET",
        "/rest/v1/hermes_runs",
        params={
            "id": f"eq.{run_id}",
            "select": "id,task_id,agent_name,status,tokens_used,cost_usd,duration_ms,started_at,finished_at",
            "limit": "1",
        },
    )
    if not isinstance(rows, list) or not rows:
        raise HTTPException(status_code=404, detail="Hermes run not found")
    run = rows[0]
    if run.get("status") not in {"COMPLETED", "FAILED", "CANCELLED"}:
        raise HTTPException(status_code=409, detail="Hermes run must be terminal before cost attribution")
    if run.get("cost_usd") is None:
        raise HTTPException(status_code=409, detail="Hermes run has no recorded cost_usd")

    try:
        amount = Decimal(str(run["cost_usd"]))
    except (InvalidOperation, ValueError) as exc:
        raise HTTPException(status_code=409, detail="Hermes run has invalid cost_usd") from exc
    if amount < 0:
        raise HTTPException(status_code=409, detail="Hermes run cost_usd cannot be negative")

    return await _request(
        "POST",
        "/rest/v1/rpc/moneyhub_ingest_runtime_cost",
        json={
            "p_owner_id": str(payload.owner_id),
            "p_source_system": "hermes",
            "p_source_ref": str(run["id"]),
            "p_agent_name": run.get("agent_name") or "HERMES",
            "p_amount": str(amount),
            "p_currency": payload.currency.upper(),
            "p_tokens_used": run.get("tokens_used"),
            "p_duration_ms": run.get("duration_ms"),
            "p_metadata": {
                "task_id": run.get("task_id"),
                "run_status": run.get("status"),
                "started_at": run.get("started_at"),
                "finished_at": run.get("finished_at"),
            },
        },
    )
