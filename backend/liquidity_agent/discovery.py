from __future__ import annotations

import asyncio
import re
import time
from typing import Any

import httpx

from .models import PoolCandidate
from .policy import DEFAULT_POLICY, LiquidityPolicy

DEFILLAMA_POOLS_URL = "https://yields.llama.fi/pools"
DEFILLAMA_TIMEOUT_SECONDS = 12.0
DEFILLAMA_CACHE_TTL_SECONDS = 60.0

_cache_lock = asyncio.Lock()
_cache_rows: list[dict[str, Any]] = []
_cache_expires_at = 0.0


def _as_float(value: Any) -> float | None:
    if value is None:
        return None
    try:
        return float(value)
    except (TypeError, ValueError):
        return None


def _as_bool(value: Any) -> bool | None:
    if value is None:
        return None
    if isinstance(value, bool):
        return value
    if isinstance(value, str):
        normalized = value.strip().lower()
        if normalized in {"true", "yes", "1"}:
            return True
        if normalized in {"false", "no", "0"}:
            return False
    return bool(value)


def _symbol_tokens(symbol: str | None) -> tuple[str | None, str | None]:
    if not symbol:
        return None, None
    parts = [part.strip() for part in re.split(r"[-/_]", symbol) if part.strip()]
    if len(parts) < 2:
        return parts[0] if parts else None, None
    return parts[0], parts[1]


def normalize_defillama_pool(row: dict[str, Any]) -> PoolCandidate:
    symbol = str(row.get("symbol") or "").strip() or None
    token0, token1 = _symbol_tokens(symbol)
    pool_id = str(row.get("pool") or "").strip() or None
    pool_address = pool_id if pool_id and pool_id.startswith("0x") and len(pool_id) == 42 else None

    return PoolCandidate(
        source="defillama_yields",
        chain=str(row.get("chain") or "").strip().lower(),
        protocol=str(row.get("project") or "").strip().lower(),
        pool_id=pool_id,
        pool_address=pool_address,
        symbol=symbol,
        token0=token0,
        token1=token1,
        tvl_usd=_as_float(row.get("tvlUsd")),
        volume_24h_usd=_as_float(row.get("volumeUsd1d")),
        volume_7d_usd=_as_float(row.get("volumeUsd7d")),
        fee_apy=_as_float(row.get("apyBase")),
        reward_apy=_as_float(row.get("apyReward")),
        apy_total=_as_float(row.get("apy")),
        apy_mean_30d=_as_float(row.get("apyMean30d")),
        stablecoin=_as_bool(row.get("stablecoin")),
        il_risk=str(row.get("ilRisk")) if row.get("ilRisk") is not None else None,
        exposure=str(row.get("exposure")) if row.get("exposure") is not None else None,
        outlier=_as_bool(row.get("outlier")),
        underlying_tokens=[str(x) for x in (row.get("underlyingTokens") or []) if x],
    )


def _matches(candidate: PoolCandidate, chain: str, protocol: str) -> bool:
    return candidate.chain == chain.lower() and candidate.protocol == protocol.lower()


def _passes_read_only_screen(candidate: PoolCandidate, policy: LiquidityPolicy) -> bool:
    if candidate.outlier is True:
        return False
    if candidate.tvl_usd is not None and candidate.tvl_usd < policy.min_pool_tvl_usd:
        return False
    if (
        candidate.volume_24h_usd is not None
        and candidate.volume_24h_usd < policy.min_volume_24h_usd
    ):
        return False
    return True


def _quality_sort_key(candidate: PoolCandidate) -> tuple[float, float, float]:
    return (
        candidate.volume_24h_usd or 0.0,
        candidate.tvl_usd or 0.0,
        candidate.apy_mean_30d or candidate.fee_apy or 0.0,
    )


async def _defillama_rows() -> list[dict[str, Any]]:
    global _cache_rows, _cache_expires_at

    now = time.monotonic()
    if _cache_rows and now < _cache_expires_at:
        return _cache_rows

    async with _cache_lock:
        now = time.monotonic()
        if _cache_rows and now < _cache_expires_at:
            return _cache_rows

        async with httpx.AsyncClient(timeout=DEFILLAMA_TIMEOUT_SECONDS, follow_redirects=False) as client:
            response = await client.get(
                DEFILLAMA_POOLS_URL,
                headers={"User-Agent": "D3VONN-Liquidity-Agent/0.2"},
            )
            response.raise_for_status()
            payload = response.json()

        rows = payload.get("data", []) if isinstance(payload, dict) else []
        normalized_rows = [row for row in rows if isinstance(row, dict)]
        _cache_rows = normalized_rows
        _cache_expires_at = time.monotonic() + DEFILLAMA_CACHE_TTL_SECONDS
        return _cache_rows


async def discover_defillama_pools(
    chain: str,
    protocol: str,
    *,
    limit: int = 10,
    policy: LiquidityPolicy = DEFAULT_POLICY,
) -> list[PoolCandidate]:
    """Fetch and normalize read-only pool intelligence from DefiLlama.

    The URL is fixed in code and no wallet, signing key, transaction payload, or
    user-supplied remote URL is accepted by this adapter. The upstream feed is
    cached briefly to avoid repeatedly downloading the full multi-megabyte pool set.
    """
    rows = await _defillama_rows()

    candidates: list[PoolCandidate] = []
    for row in rows:
        candidate = normalize_defillama_pool(row)
        if not _matches(candidate, chain, protocol):
            continue
        if not _passes_read_only_screen(candidate, policy):
            continue
        candidates.append(candidate)

    candidates.sort(key=_quality_sort_key, reverse=True)
    return candidates[:limit]
