"""Market-data provider abstractions for D3VONN.IO."""
from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime, timezone
from typing import Any, Protocol

import httpx


class MarketDataProvider(Protocol):
    async def get_asset_metrics(self, asset: str) -> dict[str, Any]: ...
    async def search_assets(self, query: str) -> list[dict[str, Any]]: ...
    async def get_exchanges(self) -> list[dict[str, Any]]: ...


class MarketDataNotConfigured(RuntimeError):
    """Raised when a provider is called without required credentials."""


class MarketDataUpstreamError(RuntimeError):
    """Raised when the upstream market-data provider fails."""


@dataclass(slots=True)
class MessariProvider:
    api_key: str
    base_url: str = "https://api.messari.io"
    timeout_seconds: float = 15.0

    @property
    def configured(self) -> bool:
        return bool(self.api_key.strip())

    def _headers(self) -> dict[str, str]:
        if not self.configured:
            raise MarketDataNotConfigured("Messari provider is not configured")
        return {"x-messari-api-key": self.api_key}

    async def _get(self, path: str, *, params: dict[str, Any] | None = None) -> Any:
        try:
            async with httpx.AsyncClient(
                base_url=self.base_url.rstrip("/"),
                timeout=self.timeout_seconds,
            ) as client:
                response = await client.get(path, headers=self._headers(), params=params)
                response.raise_for_status()
        except MarketDataNotConfigured:
            raise
        except httpx.HTTPError as exc:
            raise MarketDataUpstreamError("Messari request failed") from exc

        payload = response.json()
        return payload.get("data", payload) if isinstance(payload, dict) else payload

    async def get_asset_metrics(self, asset: str) -> dict[str, Any]:
        data = await self._get(f"/api/v2/assets/{asset}/metrics")
        if not isinstance(data, dict):
            raise MarketDataUpstreamError("Unexpected Messari asset response")
        return self._envelope(asset=asset, data=data)

    async def search_assets(self, query: str) -> list[dict[str, Any]]:
        data = await self._get("/api/v2/assets", params={"fields": "id,slug,symbol,name"})
        if isinstance(data, list):
            needle = query.casefold()
            return [
                item for item in data
                if needle in str(item.get("name", "")).casefold()
                or needle in str(item.get("symbol", "")).casefold()
                or needle in str(item.get("slug", "")).casefold()
            ][:25]
        return []

    async def get_exchanges(self) -> list[dict[str, Any]]:
        data = await self._get("/api/v1/exchanges")
        return data if isinstance(data, list) else []

    @staticmethod
    def _envelope(*, asset: str, data: dict[str, Any]) -> dict[str, Any]:
        return {
            "provider": "messari",
            "retrieved_at": datetime.now(timezone.utc).isoformat(),
            "asset": asset,
            "data": data,
        }


class MarketDataService:
    def __init__(self, provider: MarketDataProvider) -> None:
        self.provider = provider

    async def asset_metrics(self, asset: str) -> dict[str, Any]:
        return await self.provider.get_asset_metrics(asset)

    async def search_assets(self, query: str) -> list[dict[str, Any]]:
        return await self.provider.search_assets(query)

    async def exchanges(self) -> list[dict[str, Any]]:
        return await self.provider.get_exchanges()
