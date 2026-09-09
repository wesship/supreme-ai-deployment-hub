from __future__ import annotations

import os
import re
from typing import Any
from urllib.parse import urlparse

import httpx

from .models import AssetClass, MarketIntelligenceQuery, MarketSignal, ProviderName


_PROVIDER_CONFIG = {
    "koyfin": ("KOYFIN_MARKET_INTELLIGENCE_URL", "KOYFIN_MARKET_INTELLIGENCE_TOKEN"),
    "finviz": ("FINVIZ_MARKET_INTELLIGENCE_URL", "FINVIZ_MARKET_INTELLIGENCE_TOKEN"),
}


class ReadOnlyMarketAdapter:
    """GET-only bridge for licensed/export/provider-controlled market data."""

    def __init__(self, provider: ProviderName):
        if provider not in _PROVIDER_CONFIG:
            raise ValueError(f"Unsupported bridge provider: {provider}")
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

        headers = {"Accept": "application/json", "User-Agent": "D3VONN-MarketIntelligence/0.3"}
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


class MessariNativeAdapter:
    """Official Messari GET-only API adapter using server-side API-key auth."""

    provider: ProviderName = "messari"
    endpoint = "https://api.messari.io/metrics/v2/assets/details"
    _QUERY_STOPWORDS = {
        "about",
        "activity",
        "asset",
        "assets",
        "crypto",
        "cryptocurrency",
        "data",
        "latest",
        "market",
        "markets",
        "momentum",
        "price",
        "protocol",
        "research",
        "show",
        "the",
        "this",
        "trend",
        "trends",
        "with",
    }

    @property
    def configured(self) -> bool:
        return bool(os.getenv("MESSARI_API_KEY", "").strip())

    @classmethod
    def _query_terms(cls, query: str) -> set[str]:
        return {
            term
            for term in re.findall(r"[a-z0-9]{2,}", query.lower())
            if term not in cls._QUERY_STOPWORDS
        }

    @classmethod
    def _relevance_score(cls, row: dict[str, Any], query: MarketIntelligenceQuery) -> int:
        symbols = {symbol.upper() for symbol in query.symbols if symbol.strip()}
        row_symbol = str(row.get("symbol") or "").upper()
        if symbols:
            return 100 if row_symbol in symbols else 0

        terms = cls._query_terms(query.query)
        if not terms:
            return 0

        tags_raw = row.get("tags", [])
        tags = " ".join(str(tag) for tag in tags_raw) if isinstance(tags_raw, list) else ""
        name = str(row.get("name") or "")
        slug = str(row.get("slug") or "")
        description = str(row.get("description") or "")
        searchable = f"{name} {row_symbol} {slug} {tags} {description}".lower()
        return sum(1 for term in terms if term in searchable)

    async def collect(self, query: MarketIntelligenceQuery) -> list[MarketSignal]:
        api_key = os.getenv("MESSARI_API_KEY", "").strip()
        if not api_key:
            return []

        headers = {
            "Accept": "application/json",
            "User-Agent": "D3VONN-MarketIntelligence/0.3",
            "x-messari-api-key": api_key,
        }
        async with httpx.AsyncClient(timeout=12.0, follow_redirects=False) as client:
            response = await client.get(self.endpoint, headers=headers)
            response.raise_for_status()
            payload = response.json()

        rows = payload.get("data", []) if isinstance(payload, dict) else []
        if not isinstance(rows, list):
            return []

        ranked_rows: list[tuple[int, dict[str, Any]]] = []
        for row in rows:
            if not isinstance(row, dict):
                continue
            score = self._relevance_score(row, query)
            if score > 0:
                ranked_rows.append((score, row))
        ranked_rows.sort(key=lambda item: item[0], reverse=True)
        filtered = [row for _, row in ranked_rows[: query.max_results_per_source]]

        signals: list[MarketSignal] = []
        for row in filtered:
            name = str(row.get("name") or row.get("symbol") or "Messari asset").strip()
            symbol = str(row.get("symbol") or "").upper()[:32] or None
            market = row.get("marketData") if isinstance(row.get("marketData"), dict) else {}
            roi = row.get("returnOnInvestment") if isinstance(row.get("returnOnInvestment"), dict) else {}
            price = market.get("priceUsd")
            volume = market.get("volume24Hour")
            change24h = roi.get("priceChange24h")
            description = str(row.get("description") or "").strip()
            summary_parts = [description[:1200]] if description else []
            if price is not None:
                summary_parts.append(f"Price USD: {price}")
            if volume is not None:
                summary_parts.append(f"24h volume USD: {volume}")
            if change24h is not None:
                summary_parts.append(f"24h price change %: {change24h}")
            if not summary_parts:
                continue
            tags_raw = row.get("tags", [])
            tags = [str(tag)[:64] for tag in tags_raw[:20]] if isinstance(tags_raw, list) else []
            signals.append(
                MarketSignal(
                    provider="messari",
                    asset_class="crypto",
                    symbol=symbol,
                    title=f"{name} ({symbol or 'crypto'}) — Messari market snapshot",
                    summary=" | ".join(summary_parts)[:2000],
                    source_url=f"https://messari.io/asset/{row.get('slug')}" if row.get("slug") else "https://messari.io/",
                    confidence=0.9,
                    tags=tags,
                )
            )
        return signals


def provider_adapter(provider: ProviderName):
    if provider == "hermes_research_os":
        return None
    if provider == "messari":
        return MessariNativeAdapter()
    return ReadOnlyMarketAdapter(provider)
