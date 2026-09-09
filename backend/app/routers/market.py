"""D3VONN.IO market-data API gateway."""
from __future__ import annotations

from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Query, status

from backend.app.config import Settings, get_settings
from backend.app.market_data import (
    MarketDataNotConfigured,
    MarketDataService,
    MarketDataUpstreamError,
    MessariProvider,
)
from backend.app.middleware.auth import get_current_user_id

router = APIRouter(prefix="/market")


def get_market_service(settings: Annotated[Settings, Depends(get_settings)]) -> MarketDataService:
    return MarketDataService(
        MessariProvider(
            api_key=settings.messari_api_key,
            base_url=settings.messari_api_base_url,
            timeout_seconds=settings.messari_timeout_seconds,
        )
    )


def _translate_market_error(exc: Exception) -> HTTPException:
    if isinstance(exc, MarketDataNotConfigured):
        return HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Market data provider is not configured",
        )
    return HTTPException(
        status_code=status.HTTP_502_BAD_GATEWAY,
        detail="Market data provider request failed",
    )


@router.get("/providers/status")
async def provider_status(settings: Annotated[Settings, Depends(get_settings)]) -> dict[str, object]:
    return {
        "messari": {
            "configured": bool(settings.messari_api_key.strip()),
            "base_url": settings.messari_api_base_url,
        }
    }


@router.get("/assets/{asset}/metrics")
async def asset_metrics(
    asset: str,
    _: Annotated[str, Depends(get_current_user_id)],
    service: Annotated[MarketDataService, Depends(get_market_service)],
):
    try:
        return await service.asset_metrics(asset)
    except (MarketDataNotConfigured, MarketDataUpstreamError) as exc:
        raise _translate_market_error(exc) from exc


@router.get("/search")
async def search_assets(
    q: Annotated[str, Query(min_length=1, max_length=80)],
    _: Annotated[str, Depends(get_current_user_id)],
    service: Annotated[MarketDataService, Depends(get_market_service)],
):
    try:
        return {"provider": "messari", "query": q, "results": await service.search_assets(q)}
    except (MarketDataNotConfigured, MarketDataUpstreamError) as exc:
        raise _translate_market_error(exc) from exc


@router.get("/exchanges")
async def exchanges(
    _: Annotated[str, Depends(get_current_user_id)],
    service: Annotated[MarketDataService, Depends(get_market_service)],
):
    try:
        return {"provider": "messari", "results": await service.exchanges()}
    except (MarketDataNotConfigured, MarketDataUpstreamError) as exc:
        raise _translate_market_error(exc) from exc
