from __future__ import annotations

import hashlib
import json
from datetime import datetime, timezone
from typing import Any

from .models import IntelligenceEntity, IntelligenceEvent, IntelligenceEvidence

_TOOL_DOMAINS = {
    "get_world_brief": ("global", "world_brief"),
    "get_cyber_threats": ("cyber", "cyber_threat"),
    "get_news_intelligence": ("news", "news_signal"),
    "get_infrastructure_status": ("infrastructure", "infrastructure_outage"),
    "get_research_signals": ("technology", "research_signal"),
    "get_market_data": ("markets", "market_signal"),
    "get_energy_intelligence": ("energy", "energy_signal"),
    "get_chokepoint_status": ("supply_chain", "chokepoint_signal"),
}

_LIST_KEYS = (
    "items",
    "events",
    "signals",
    "threats",
    "outages",
    "articles",
    "alerts",
    "providers",
    "results",
    "data",
)


def _fingerprint(tool_name: str, value: Any) -> str:
    canonical = json.dumps(value, sort_keys=True, separators=(",", ":"), default=str)
    return hashlib.sha256(f"worldmonitor:{tool_name}:{canonical}".encode()).hexdigest()


def _severity(value: Any) -> float:
    if isinstance(value, (int, float)):
        raw = float(value)
        return max(0.0, min(1.0, raw / 100.0 if raw > 1 else raw))
    mapping = {
        "critical": 1.0,
        "severe": 0.9,
        "high": 0.8,
        "elevated": 0.65,
        "medium": 0.5,
        "moderate": 0.5,
        "low": 0.25,
        "normal": 0.05,
        "none": 0.0,
    }
    return mapping.get(str(value or "").strip().lower(), 0.35)


def _confidence(value: Any) -> float:
    if isinstance(value, (int, float)):
        raw = float(value)
        return max(0.0, min(1.0, raw / 100.0 if raw > 1 else raw))
    return 0.7


def _datetime(value: Any) -> datetime:
    if isinstance(value, datetime):
        return value if value.tzinfo else value.replace(tzinfo=timezone.utc)
    if isinstance(value, str) and value:
        try:
            return datetime.fromisoformat(value.replace("Z", "+00:00"))
        except ValueError:
            pass
    return datetime.now(timezone.utc)


def _first(mapping: dict[str, Any], *keys: str) -> Any:
    for key in keys:
        value = mapping.get(key)
        if value not in (None, "", [], {}):
            return value
    return None


def unwrap_mcp_result(result: dict[str, Any]) -> Any:
    structured = result.get("structuredContent")
    if structured not in (None, {}, []):
        return structured

    content = result.get("content")
    if isinstance(content, list):
        for block in content:
            if not isinstance(block, dict):
                continue
            text = block.get("text")
            if not isinstance(text, str):
                continue
            try:
                return json.loads(text)
            except json.JSONDecodeError:
                return {"summary": text}
    return result


def _records(payload: Any) -> list[dict[str, Any]]:
    if isinstance(payload, list):
        return [item for item in payload if isinstance(item, dict)]
    if not isinstance(payload, dict):
        return []
    for key in _LIST_KEYS:
        value = payload.get(key)
        if isinstance(value, list) and any(isinstance(item, dict) for item in value):
            return [item for item in value if isinstance(item, dict)]
    for value in payload.values():
        if isinstance(value, dict):
            nested = _records(value)
            if nested:
                return nested
    return []


def _evidence(record: dict[str, Any]) -> list[IntelligenceEvidence]:
    url = _first(record, "url", "link", "source_url", "sourceUrl")
    source = _first(record, "source", "provider", "publisher")
    published_at = _first(record, "published_at", "publishedAt", "timestamp", "updated_at")
    if not url and not source:
        return []
    return [
        IntelligenceEvidence(
            title=str(_first(record, "headline", "title", "name") or "") or None,
            url=str(url) if url else None,
            source=str(source) if source else None,
            published_at=str(published_at) if published_at else None,
        )
    ]


def _entities(record: dict[str, Any]) -> list[IntelligenceEntity]:
    entities: list[IntelligenceEntity] = []
    for key, entity_type in (
        ("country", "country"),
        ("provider", "provider"),
        ("organization", "organization"),
        ("company", "company"),
        ("actor", "actor"),
        ("service", "service"),
    ):
        value = record.get(key)
        if isinstance(value, str) and value.strip():
            entities.append(IntelligenceEntity(name=value.strip(), type=entity_type))
    return entities


def _one_event(tool_name: str, record: dict[str, Any], *, aggregate: bool = False) -> IntelligenceEvent:
    domain, event_type = _TOOL_DOMAINS[tool_name]
    raw_id = _first(record, "id", "event_id", "eventId", "uuid", "case_id")
    fingerprint = str(raw_id) if raw_id else _fingerprint(tool_name, record)
    title = _first(record, "title", "headline", "name", "event", "service", "provider")
    summary = _first(record, "summary", "description", "details", "message", "analysis")
    if aggregate and not title:
        title = "World Monitor global intelligence brief"
    if aggregate and not summary:
        summary = json.dumps(record, default=str)[:4000]

    location: dict[str, Any] = {}
    for key in ("country", "region", "location", "lat", "lon", "lng"):
        if key in record:
            location[key] = record[key]

    return IntelligenceEvent(
        domain=domain,
        event_type=event_type,
        title=str(title)[:500] if title else None,
        summary=str(summary)[:8000] if summary else None,
        entities=_entities(record),
        location=location,
        severity=_severity(_first(record, "severity", "risk", "risk_level", "level")),
        confidence=_confidence(_first(record, "confidence", "confidence_score", "score")),
        observed_at=_datetime(_first(record, "observed_at", "timestamp", "updated_at", "published_at", "start_time")),
        evidence=_evidence(record),
        raw_source_id=fingerprint,
        raw=record,
    )


def normalize_tool_result(tool_name: str, result: dict[str, Any]) -> list[IntelligenceEvent]:
    if tool_name not in _TOOL_DOMAINS:
        raise ValueError(f"Unsupported World Monitor tool: {tool_name}")

    payload = unwrap_mcp_result(result)
    if tool_name == "get_world_brief":
        record = payload if isinstance(payload, dict) else {"summary": str(payload)}
        return [_one_event(tool_name, record, aggregate=True)]

    records = _records(payload)
    if not records and isinstance(payload, dict):
        records = [payload]
    return [_one_event(tool_name, record) for record in records]
