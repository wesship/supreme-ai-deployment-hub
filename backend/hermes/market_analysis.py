"""Hermes -> ION read-only market analysis handoff."""
from __future__ import annotations

from typing import Any, Awaitable, Callable

from backend.market_intelligence.models import MarketIntelligenceResponse

CreateTaskFn = Callable[..., Awaitable[dict[str, Any]]]
LogEventFn = Callable[..., Awaitable[None]]


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
    log_event_fn: LogEventFn | None = None,
    parent_task_id: str | None = None,
    correlation_id: str | None = None,
) -> dict[str, Any]:
    """Create a canonical Hermes task for ION and emit a provenance audit event."""
    if create_task_fn is None or log_event_fn is None:
        from backend.hermes.task_engine import create_task, log_event

        create_task_fn = create_task_fn or create_task
        log_event_fn = log_event_fn or log_event

    payload = build_ion_market_payload(response)
    task = await create_task_fn(
        title=f"ION market analysis: {response.query.query}",
        task_type="market_analysis",
        description="Analyze ranked read-only market evidence. Do not execute trades or external actions.",
        agent_name="ION",
        input_data=payload,
        parent_task_id=parent_task_id,
        source="hermes_market_intelligence",
        correlation_id=correlation_id,
    )

    confidences = [signal["confidence"] for signal in payload["signals"]]
    await log_event_fn(
        event="hermes.market_analysis.handoff",
        message="Hermes handed ranked read-only market evidence to ION",
        task_id=task.get("id"),
        agent_name="ION",
        correlation_id=correlation_id,
        data={
            "parent_task_id": parent_task_id,
            "query": response.query.query,
            "providers": payload["provenance"]["providers"],
            "signal_count": len(payload["signals"]),
            "confidence_min": min(confidences) if confidences else None,
            "confidence_max": max(confidences) if confidences else None,
            "confidence_avg": (sum(confidences) / len(confidences)) if confidences else None,
            "provider_errors": payload["provider_errors"],
            "analysis_only": True,
            "execution_allowed": False,
        },
    )
    return task
