from __future__ import annotations

import os
import re
from statistics import mean
from typing import Any
from urllib.parse import quote, urlparse

import httpx

from .models import PoolHistoryPoint, PoolHistorySummary

GRAPH_TIMEOUT_SECONDS = 10.0
_SUBGRAPH_ID_RE = re.compile(r"^[A-Za-z0-9_-]{20,128}$")

_POOL_HISTORY_QUERY = """
query PoolHistory($pool: String!, $first: Int!) {
  poolDayDatas(
    first: $first
    orderBy: date
    orderDirection: desc
    where: { pool: $pool }
  ) {
    date
    liquidity
    sqrtPrice
    token0Price
    token1Price
    tick
    tvlUSD
    volumeUSD
    feesUSD
    txCount
  }
}
"""


def _endpoint() -> tuple[str | None, str]:
    """Resolve an explicitly configured historical-data endpoint.

    D3VONN does not silently trust a hard-coded third-party subgraph deployment.
    Operators must supply either a full GraphQL endpoint, or both a Graph gateway
    API key and the subgraph deployment ID they have reviewed.
    """
    configured = (os.getenv("LIQUIDITY_UNISWAP_V3_SUBGRAPH_URL") or "").strip()
    if configured:
        parsed = urlparse(configured)
        if parsed.scheme in {"http", "https"} and parsed.netloc:
            return configured, "operator_configured_graph"

    api_key = (os.getenv("LIQUIDITY_THE_GRAPH_API_KEY") or os.getenv("THE_GRAPH_API_KEY") or "").strip()
    subgraph_id = (os.getenv("LIQUIDITY_UNISWAP_V3_SUBGRAPH_ID") or "").strip()
    if api_key and subgraph_id and _SUBGRAPH_ID_RE.fullmatch(subgraph_id):
        safe_key = quote(api_key, safe="")
        safe_id = quote(subgraph_id, safe="")
        return (
            f"https://gateway.thegraph.com/api/{safe_key}/subgraphs/id/{safe_id}",
            "the_graph_gateway_explicit_deployment",
        )
    return None, "not_configured"


def _float(value: Any) -> float | None:
    if value is None:
        return None
    try:
        return float(value)
    except (TypeError, ValueError):
        return None


def _int(value: Any) -> int | None:
    if value is None:
        return None
    try:
        return int(value)
    except (TypeError, ValueError):
        return None


def normalize_history_point(row: dict[str, Any]) -> PoolHistoryPoint:
    return PoolHistoryPoint(
        date=_int(row.get("date")) or 0,
        liquidity=str(row.get("liquidity")) if row.get("liquidity") is not None else None,
        sqrt_price_x96=str(row.get("sqrtPrice")) if row.get("sqrtPrice") is not None else None,
        token0_price=_float(row.get("token0Price")),
        token1_price=_float(row.get("token1Price")),
        tick=_int(row.get("tick")),
        tvl_usd=_float(row.get("tvlUSD")),
        volume_usd=_float(row.get("volumeUSD")),
        fees_usd=_float(row.get("feesUSD")),
        tx_count=_int(row.get("txCount")),
    )


def summarize_history(points: list[PoolHistoryPoint], source: str) -> PoolHistorySummary:
    tvls = [item.tvl_usd for item in points if item.tvl_usd is not None and item.tvl_usd > 0]
    volumes = [item.volume_usd for item in points if item.volume_usd is not None]
    fees = [item.fees_usd for item in points if item.fees_usd is not None]

    avg_tvl = mean(tvls) if tvls else None
    total_volume = sum(volumes) if volumes else None
    total_fees = sum(fees) if fees else None
    fee_to_tvl_bps = None
    annualized_fee_to_tvl_pct = None

    if avg_tvl and total_fees is not None and points:
        fee_to_tvl_bps = (total_fees / avg_tvl) * 10_000
        annualized_fee_to_tvl_pct = (total_fees / avg_tvl) * (365 / len(points)) * 100

    return PoolHistorySummary(
        status="ok" if points else "no_data",
        source=source,
        days_returned=len(points),
        avg_tvl_usd=avg_tvl,
        total_volume_usd=total_volume,
        total_fees_usd=total_fees,
        fee_to_avg_tvl_bps=fee_to_tvl_bps,
        annualized_fee_to_avg_tvl_pct=annualized_fee_to_tvl_pct,
        points=points,
    )


async def fetch_uniswap_v3_pool_history(pool_address: str, days: int = 30) -> PoolHistorySummary:
    """Fetch fixed-schema historical Base Uniswap V3 pool data.

    The endpoint is explicitly operator configured. No user-provided remote URL,
    Graph API key, or subgraph deployment ID is accepted through the request API.
    """
    endpoint, source = _endpoint()
    if not endpoint:
        return PoolHistorySummary(
            status="not_configured",
            source=source,
            days_returned=0,
            points=[],
        )

    payload = {
        "query": _POOL_HISTORY_QUERY,
        "variables": {
            "pool": pool_address.lower(),
            "first": max(1, min(days, 90)),
        },
    }
    async with httpx.AsyncClient(timeout=GRAPH_TIMEOUT_SECONDS, follow_redirects=False) as client:
        response = await client.post(endpoint, json=payload)
        response.raise_for_status()
        body = response.json()

    if not isinstance(body, dict) or body.get("errors"):
        raise ValueError("graph_query_failed")
    data = body.get("data")
    rows = data.get("poolDayDatas", []) if isinstance(data, dict) else []
    if not isinstance(rows, list):
        raise ValueError("invalid_graph_response")

    points = [normalize_history_point(row) for row in rows if isinstance(row, dict)]
    return summarize_history(points, source)
