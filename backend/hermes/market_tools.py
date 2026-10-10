"""Governed read-only market tools for Hermes/TARS.

This module is deliberately vendor-agnostic at the Hermes boundary. The
provider is constructed behind MarketDataService so agent logic never depends
on Messari response schemas or credentials.
"""
from __future__ import annotations

from typing import Any

from backend.app.config import Settings, get_settings
from backend.app.market_data import MarketDataService, MessariProvider

MARKET_TOOL_NAMES = frozenset(
    {
        "market.lookup_asset",
        "market.search_assets",
        "market.list_exchanges",
    }
)


def build_market_service(settings: Settings | None = None) -> MarketDataService:
    cfg = settings or get_settings()
    return MarketDataService(
        MessariProvider(
            api_key=cfg.messari_api_key,
            base_url=cfg.messari_api_base_url,
            timeout_seconds=cfg.messari_timeout_seconds,
        )
    )


async def invoke_market_tool(
    tool_name: str,
    arguments: dict[str, Any] | None = None,
    *,
    service: MarketDataService | None = None,
) -> Any:
    """Invoke one allow-listed, read-only market tool.

    No trading, custody, order placement, or arbitrary upstream URL access is
    available from this surface.
    """
    if tool_name not in MARKET_TOOL_NAMES:
        raise ValueError(f"Unknown market tool: {tool_name}")

    args = arguments or {}
    market = service or build_market_service()

    if tool_name == "market.lookup_asset":
        asset = str(args.get("asset", "")).strip()
        if not asset:
            raise ValueError("market.lookup_asset requires a non-empty 'asset'")
        return await market.asset_metrics(asset)

    if tool_name == "market.search_assets":
        query = str(args.get("query", "")).strip()
        if not query:
            raise ValueError("market.search_assets requires a non-empty 'query'")
        return {
            "provider": "messari",
            "query": query,
            "results": await market.search_assets(query),
        }

    return {
        "provider": "messari",
        "results": await market.exchanges(),
    }
