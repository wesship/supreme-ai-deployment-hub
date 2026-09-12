"""Observed provider/style performance signals for AI Films routing and operations."""
from __future__ import annotations

from collections import defaultdict
from datetime import datetime
from typing import Any, Iterable, Mapping


def _key(provider: str, style_id: str | None = None) -> str:
    return f"{provider}|{style_id}" if style_id else provider


def summarize_provider_performance(rows: Iterable[Mapping[str, Any]]) -> dict[str, dict[str, Any]]:
    buckets: dict[str, dict[str, float]] = defaultdict(
        lambda: {"samples": 0.0, "passes": 0.0, "revises": 0.0, "blocks": 0.0, "confidence_sum": 0.0, "confidence_samples": 0.0}
    )
    for row in rows:
        provider = str(row.get("provider") or "").strip().lower()
        if not provider:
            continue
        quality = row.get("quality_metadata") if isinstance(row.get("quality_metadata"), Mapping) else {}
        decision = str(quality.get("decision") or "").strip().lower()
        if decision not in {"pass", "revise", "block"}:
            continue
        visual = row.get("visual_context") if isinstance(row.get("visual_context"), Mapping) else {}
        style_id = str(visual.get("style_id") or "").strip() or None
        keys = [provider]
        if style_id:
            keys.append(_key(provider, style_id))
        for bucket_key in keys:
            bucket = buckets[bucket_key]
            bucket["samples"] += 1
            bucket[f"{decision}es" if decision == "pass" else f"{decision}s"] += 1
            confidence = quality.get("confidence")
            try:
                if confidence is not None:
                    bucket["confidence_sum"] += max(0.0, min(1.0, float(confidence)))
                    bucket["confidence_samples"] += 1
            except (TypeError, ValueError):
                pass

    out: dict[str, dict[str, Any]] = {}
    for bucket_key, bucket in buckets.items():
        samples = int(bucket["samples"])
        confidence_samples = int(bucket["confidence_samples"])
        out[bucket_key] = {
            "samples": samples,
            "pass_rate": (bucket["passes"] / samples) if samples else 0.0,
            "revise_rate": (bucket["revises"] / samples) if samples else 0.0,
            "block_rate": (bucket["blocks"] / samples) if samples else 0.0,
            "mean_confidence": (bucket["confidence_sum"] / confidence_samples) if confidence_samples else None,
        }
    return out


def routing_adjustment(
    performance: Mapping[str, Mapping[str, Any]] | None,
    *,
    provider: str,
    style_id: str | None = None,
) -> tuple[int, tuple[str, ...]]:
    """Return a conservative score nudge capped to [-15, +15]."""
    if not performance:
        return 0, ()
    provider_data = performance.get(provider)
    style_data = performance.get(_key(provider, style_id)) if style_id else None
    chosen = style_data if isinstance(style_data, Mapping) and int(style_data.get("samples") or 0) >= 3 else provider_data
    if not isinstance(chosen, Mapping):
        return 0, ()
    samples = int(chosen.get("samples") or 0)
    if samples < 3:
        return 0, ()
    pass_rate = float(chosen.get("pass_rate") or 0.0)
    block_rate = float(chosen.get("block_rate") or 0.0)
    confidence = chosen.get("mean_confidence")
    confidence_value = float(confidence) if confidence is not None else 0.5
    raw = round((pass_rate - 0.5) * 20 + (confidence_value - 0.5) * 8 - block_rate * 8)
    adjustment = max(-15, min(15, int(raw)))
    scope = "style" if chosen is style_data else "provider"
    return adjustment, (f"observed_{scope}_performance:{samples}:{adjustment:+d}",)


def _latency_seconds(row: Mapping[str, Any]) -> float | None:
    started = row.get("started_at")
    completed = row.get("completed_at")
    if not started or not completed:
        return None
    try:
        start = datetime.fromisoformat(str(started).replace("Z", "+00:00"))
        end = datetime.fromisoformat(str(completed).replace("Z", "+00:00"))
        return max(0.0, (end - start).total_seconds())
    except (TypeError, ValueError):
        return None


def _reported_cost(metadata: Mapping[str, Any]) -> float | None:
    for key in ("cost_usd", "cost", "estimated_cost"):
        try:
            value = metadata.get(key)
            if value is not None:
                return max(0.0, float(value))
        except (TypeError, ValueError):
            continue
    billing = metadata.get("billing")
    if isinstance(billing, Mapping):
        for key in ("cost_usd", "cost", "amount_usd"):
            try:
                value = billing.get(key)
                if value is not None:
                    return max(0.0, float(value))
            except (TypeError, ValueError):
                continue
    return None


def summarize_provider_intelligence(rows: Iterable[Mapping[str, Any]]) -> dict[str, Any]:
    """Create dashboard metrics without mutating routing or provider state."""
    materialized = [dict(row) for row in rows]
    performance = summarize_provider_performance(materialized)
    buckets: dict[str, dict[str, Any]] = defaultdict(lambda: {
        "jobs": 0,
        "completed": 0,
        "failed": 0,
        "regenerations": 0,
        "latencies": [],
        "reported_costs": [],
        "styles": set(),
    })
    for row in materialized:
        provider = str(row.get("provider") or "unknown").strip().lower() or "unknown"
        bucket = buckets[provider]
        bucket["jobs"] += 1
        status = str(row.get("status") or "").strip().lower()
        if status in {"completed", "succeeded"}:
            bucket["completed"] += 1
        if status in {"failed", "error"}:
            bucket["failed"] += 1
        if row.get("parent_job_id") or int(row.get("regeneration_count") or 0) > 0:
            bucket["regenerations"] += 1
        latency = _latency_seconds(row)
        if latency is not None:
            bucket["latencies"].append(latency)
        cost_metadata = row.get("cost_metadata") if isinstance(row.get("cost_metadata"), Mapping) else {}
        cost = _reported_cost(cost_metadata)
        if cost is not None:
            bucket["reported_costs"].append(cost)
        visual = row.get("visual_context") if isinstance(row.get("visual_context"), Mapping) else {}
        style_id = str(visual.get("style_id") or "").strip()
        if style_id:
            bucket["styles"].add(style_id)

    providers: list[dict[str, Any]] = []
    for provider, bucket in sorted(buckets.items()):
        jobs = int(bucket["jobs"])
        latencies = bucket["latencies"]
        costs = bucket["reported_costs"]
        quality = performance.get(provider, {})
        adjustment, evidence = routing_adjustment(performance, provider=provider)
        providers.append({
            "provider": provider,
            "jobs": jobs,
            "completed": int(bucket["completed"]),
            "failed": int(bucket["failed"]),
            "failure_rate": (bucket["failed"] / jobs) if jobs else 0.0,
            "regenerations": int(bucket["regenerations"]),
            "regeneration_rate": (bucket["regenerations"] / jobs) if jobs else 0.0,
            "mean_latency_seconds": (sum(latencies) / len(latencies)) if latencies else None,
            "reported_cost_usd_total": sum(costs) if costs else None,
            "reported_cost_samples": len(costs),
            "styles": sorted(bucket["styles"]),
            "quality": quality,
            "routing_adjustment": adjustment,
            "routing_evidence": list(evidence),
        })
    return {
        "sampled_jobs": len(materialized),
        "providers": providers,
        "styles": [{"key": key, **value} for key, value in sorted(performance.items()) if "|" in key],
        "policy": {"read_only": True, "minimum_quality_samples": 3, "routing_adjustment_bounds": [-15, 15]},
    }
