"""Hermes -> ION read-only market analysis handoff."""
from __future__ import annotations

from typing import Any, Awaitable, Callable

from backend.market_intelligence.models import MarketIntelligenceResponse

CreateTaskFn = Callable[..., Awaitable[dict[str, Any]]]


def build_ion_market_payload(response: MarketIntelligenceResponse) -> dict[str, Any]:
    """Build a vendor-neutral, read-only payload for ION analysis."""
    signals = [
        {
            "provider": signal.provider,
            "asset_class": signal.asset_class,
            "symbol": signal.symbol,
            "title": signal.title,
            "summary": signal.summary,
            "source_url": signal.source_url,
            "observed_at": signal.observed_at.isoformat(),
            "confidence": signal.confidence,
            "tags": signal.tags,
        }
        for signal in response.signals
    ]
    providers = [
        {
            "provider": item.provider,
            "configured": item.configured,
            "enabled": item.enabled,
            "mode": item.mode,
            "execution_enabled": item.execution_enabled,
        }
        for item in response.providers
    ]
    return {
        "schema": "d3vonn.hermes.ion-market-analysis/v1",
        "query": response.query.model_dump(mode="json"),
        "summary": response.summary,
        "signals": signals,
        "providers": providers,
        "provider_errors": response.provider_errors,
        "provenance": {
            "source_system": "backend.market_intelligence",
            "ranking_layer": "backend.research_os",
            "providers": sorted({signal.provider for signal in response.signals}),
            "confidence_scored": True,
        },
        "policy": {
            "execution_allowed": False,
            "trading_allowed": False,
            "signing_allowed": False,
            "broadcast_allowed": False,
            "analysis_only": True,
        },
    }


async def create_ion_market_analysis_task(
    response: MarketIntelligenceResponse,
    *,
    create_task_fn: CreateTaskFn | None = None,
    parent_task_id: str | None = None,
    correlation_id: str | None = None,
) -> dict[str, Any]:
    """Create a canonical Hermes task for ION to analyze ranked market evidence."""
    if create_task_fn is None:
        from backend.hermes.task_engine import create_task as create_task_fn

    payload = build_ion_market_payload(response)
    return await create_task_fn(
        title=f"ION market analysis: {response.query.query}",
        task_type="market_analysis",
        description="Analyze ranked read-only market evidence. Do not execute trades or external actions.",
        agent_name="ION",
        input_data=payload,
        parent_task_id=parent_task_id,
        source="hermes_market_intelligence",
        correlation_id=correlation_id,
    )
