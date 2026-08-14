"""MoneyHub paper mark-to-market and performance monitoring API."""
from __future__ import annotations

import uuid
from decimal import Decimal

from fastapi import APIRouter
from pydantic import BaseModel, Field

from backend.auth.supabase_jwt import AuthenticatedAccess
from backend.moneyhub.router import _request

router = APIRouter(prefix="/moneyhub/paper", tags=["moneyhub-paper-monitor"])


class Quote(BaseModel):
    symbol: str = Field(min_length=1, max_length=64)
    price: Decimal = Field(gt=0)


class MarkToMarketRequest(BaseModel):
    run_id: uuid.UUID
    quotes: list[Quote] = Field(min_length=1, max_length=500)


@router.post("/mark-to-market")
async def mark_to_market(payload: MarkToMarketRequest, principal: AuthenticatedAccess):
    result = await _request(
        "POST",
        "/rest/v1/rpc/moneyhub_paper_mark_to_market",
        json={
            "p_owner_id": principal.user_id,
            "p_run_id": str(payload.run_id),
            "p_quotes": [
                {"symbol": quote.symbol.upper(), "price": str(quote.price)}
                for quote in payload.quotes
            ],
        },
    )
    snapshot = await _request(
        "POST",
        "/rest/v1/rpc/moneyhub_paper_snapshot",
        json={"p_owner_id": principal.user_id, "p_run_id": str(payload.run_id)},
    )
    return {"mark_to_market": result, "performance": snapshot}


@router.post("/runs/{run_id}/snapshot")
async def snapshot_run(run_id: uuid.UUID, principal: AuthenticatedAccess):
    return await _request(
        "POST",
        "/rest/v1/rpc/moneyhub_paper_snapshot",
        json={"p_owner_id": principal.user_id, "p_run_id": str(run_id)},
    )
