"""Read-only OCC market-intelligence telemetry surface."""
from __future__ import annotations

from datetime import datetime, timezone
from statistics import fmean
from typing import Any

import httpx
from fastapi import APIRouter, Depends, HTTPException, Query

from backend.hermes.infrastructure import HermesInfrastructureConfig, SupabaseRestClient
from backend.occ_operator.auth import require_operator_access

router = APIRouter(dependencies=[Depends(require_operator_access)])

_CONFIG = HermesInfrastructureConfig.from_env()
_SUPABASE = SupabaseRestClient(_CONFIG)
_EVENT_NAME = "hermes.market_analysis.handoff"
_EVENT_TABLE = "hermes_logs"


def _utc_now() -> str:
    return datetime.now(timezone.utc).isoformat()


def _safe_number(value: Any) -> float | None:
    if isinstance(value, bool):
        return None
    if isinstance(value, (int, float)):
        return float(value)
    return None


def _confidence_from_data(data: dict[str, Any]) -> tuple[float | None, float | None, float | None]:
    """Read the canonical flat Hermes fields, while tolerating the older nested test fixture shape."""
    nested = data.get("confidence") if isinstance(data.get("confidence"), dict) else {}
    minimum = _safe_number(data.get("confidence_min"))
    maximum = _safe_number(data.get("confidence_max"))
    average = _safe_number(data.get("confidence_avg"))
    if minimum is None:
        minimum = _safe_number(nested.get("min"))
    if maximum is None:
        maximum = _safe_number(nested.get("max"))
    if average is None:
        average = _safe_number(nested.get("avg"))
    return minimum, maximum, average


def summarize_market_handoffs(rows: list[dict[str, Any]]) -> dict[str, Any]:
    events: list[dict[str, Any]] = []
    all_confidence: list[float] = []
    providers: set[str] = set()
    provider_errors = 0

    for row in rows:
        data = row.get("data") if isinstance(row.get("data"), dict) else {}
        minimum, maximum, average = _confidence_from_data(data)
        if average is not None:
            all_confidence.append(average)

        row_providers = [str(item) for item in data.get("providers", []) if item]
        providers.update(row_providers)
        errors = data.get("provider_errors") if isinstance(data.get("provider_errors"), dict) else {}
        provider_errors += len(errors)

        events.append(
            {
                "id": row.get("id"),
                "created_at": row.get("created_at"),
                "task_id": row.get("task_id"),
                "correlation_id": row.get("correlation_id"),
                "agent_name": row.get("agent_name") or "ION",
                "providers": row_providers,
                "signal_count": int(data.get("signal_count") or 0),
                "confidence": {"min": minimum, "max": maximum, "avg": average},
                "provider_errors": errors,
                "analysis_only": bool(data.get("analysis_only", True)),
                "execution_allowed": bool(data.get("execution_allowed", False)),
            }
        )

    return {
        "timestamp": _utc_now(),
        "event_type": _EVENT_NAME,
        "source_table": _EVENT_TABLE,
        "summary": {
            "handoffs": len(events),
            "providers": sorted(providers),
            "provider_error_count": provider_errors,
            "average_confidence": round(fmean(all_confidence), 4) if all_confidence else None,
            "analysis_only": all(event["analysis_only"] for event in events) if events else True,
            "execution_allowed": any(event["execution_allowed"] for event in events),
        },
        "events": events,
    }


@router.get("/market-intelligence", tags=["operator", "market-intelligence"])
async def operator_market_intelligence(
    limit: int = Query(default=50, ge=1, le=200),
) -> dict[str, Any]:
    if not _SUPABASE.configured:
        return {
            "timestamp": _utc_now(),
            "configured": False,
            "event_type": _EVENT_NAME,
            "source_table": _EVENT_TABLE,
            "summary": {
                "handoffs": 0,
                "providers": [],
                "provider_error_count": 0,
                "average_confidence": None,
                "analysis_only": True,
                "execution_allowed": False,
            },
            "events": [],
        }

    try:
        rows = await _SUPABASE.get(
            _EVENT_TABLE,
            {
                "event": f"eq.{_EVENT_NAME}",
                "order": "created_at.desc",
                "limit": str(limit),
            },
        )
    except httpx.HTTPStatusError as exc:
        raise HTTPException(status_code=502, detail="Unable to read Hermes market telemetry.") from exc

    return {"configured": True, **summarize_market_handoffs(rows)}
