"""Observed provider/style performance signals for AI Films routing.

These helpers only summarize completed render/QA history. They never enable a provider,
change credentials, or bypass executable-worker gates.
"""
from __future__ import annotations

from collections import defaultdict
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
