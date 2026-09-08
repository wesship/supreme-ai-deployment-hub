from __future__ import annotations

import os
from typing import Any
from urllib.parse import urlparse

import httpx

from .models import AssetClass, MarketIntelligenceQuery, MarketSignal, ProviderName


_PROVIDER_CONFIG = {
    "koyfin": ("KOYFIN_MARKET_INTELLIGENCE_URL", "KOYFIN_MARKET_INTELLIGENCE_TOKEN"),
    "finviz": ("FINVIZ_MARKET_INTELLIGENCE_URL", "FINVIZ_MARKET_INTELLIGENCE_TOKEN"),
    "messari": ("MESSARI_MARKET_INTELLIGENCE_URL", "MESSARI_MARKET_INTELLIGENCE_TOKEN"),
}


class ReadOnlyMarketAdapter:
    """GET-only bridge for licensed/export/provider-controlled market data.

    The destination is configured by operators through environment variables,
    never supplied by the request. No order, signing, wallet, or broadcast
    methods exist in this adapter.
    """

    def __init__(self, provider: ProviderName):
        if provider not in _PROVIDER_CONFIG:
            raise ValueError(f"Unsupported read-only provider: {provider}")
        self.provider = provider
        self.url_env, self.token_env = _PROVIDER_CONFIG[provider]

    @property
    def url(self) -> str:
        return os.getenv(self.url_env, "").strip()

    @property
    def configured(self) -> bool:
        return self._valid_https_url(self.url)

    @staticmethod
    def _valid_https_url(url: str) -> bool:
        if not url:
            return False
        parsed = urlparse(url)
        if parsed.scheme != "https" or not parsed.hostname:
            return False
        hostname = parsed.hostname.lower()
        if hostname in {"localhost", "127.0.0.1", "::1"} or hostname.endswith(".local"):
            return False
        return True

    async def collect(self, query: MarketIntelligenceQuery) -> list[MarketSignal]:
        if not self.configured:
            return []

        headers = {"Accept": "application/json", "User-Agent": "D3VONN-MarketIntelligence/0.2"}
        token = os.getenv(self.token_env, "").strip()
        if token:
            headers["Authorization"] = f"Bearer {token}"

        params = {
            "q": query.query,
            "asset_class": query.asset_class,
            "symbols": ",".join(query.symbols),
            "limit": query.max_results_per_source,
        }
        async with httpx.AsyncClient(timeout=12.0, follow_redirects=False) as client:
            response = await client.get(self.url, params=params, headers=headers)
            response.raise_for_status()
            payload = response.json()

        rows = payload.get("items", []) if isinstance(payload, dict) else payload
        if not isinstance(rows, list):
            return []

        signals: list[MarketSignal] = []
        for row in rows[: query.max_results_per_source]:
            if not isinstance(row, dict):
                continue
            signal = self._normalize(row, query.asset_class)
            if signal is not None:
                signals.append(signal)
        return signals

    def _normalize(self, row: dict[str, Any], requested_asset_class: AssetClass) -> MarketSignal | None:
        title = str(row.get("title") or row.get("name") or "").strip()
        summary = str(row.get("summary") or row.get("snippet") or row.get("description") or "").strip()
        if not title or not summary:
            return None

        asset_class = str(row.get("asset_class") or requested_asset_class)
        if asset_class not in {"equity", "etf", "crypto", "macro", "mixed"}:
            asset_class = requested_asset_class

        confidence_raw = row.get("confidence", 0.5)
        try:
            confidence = max(0.0, min(1.0, float(confidence_raw)))
        except (TypeError, ValueError):
            confidence = 0.5

        tags_raw = row.get("tags", [])
        tags = [str(tag)[:64] for tag in tags_raw[:20]] if isinstance(tags_raw, list) else []

        symbol_raw = row.get("symbol")
        url_raw = row.get("source_url") or row.get("url")
        return MarketSignal(
            provider=self.provider,
            asset_class=asset_class,
            symbol=str(symbol_raw).upper()[:32] if symbol_raw else None,
            title=title[:240],
            summary=summary[:2000],
            source_url=str(url_raw)[:1000] if url_raw else None,
            confidence=confidence,
            tags=tags,
        )


def provider_adapter(provider: ProviderName) -> ReadOnlyMarketAdapter | None:
    if provider == "hermes_research_os":
        return None
    return ReadOnlyMarketAdapter(provider)
