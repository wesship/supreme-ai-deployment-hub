"""Generation lifecycle helpers for provider results, QA, and controlled regeneration."""
from __future__ import annotations

from typing import Any, Mapping


def _truthy(value: Any) -> bool:
    return str(value or "").strip().lower() in {"1", "true", "yes", "on"}


def provider_cost_metadata(
    *payloads: Mapping[str, Any] | None,
    provider: str,
    model: str | None,
    seconds: Any = None,
    size: Any = None,
) -> dict[str, Any]:
    """Persist only provider-reported usage/cost fields; never infer money spent."""
    metadata: dict[str, Any] = {"provider": provider, "model": model}
    if seconds is not None:
        metadata["seconds"] = seconds
    if size is not None:
        metadata["size"] = size

    for payload in payloads:
        if not isinstance(payload, Mapping):
            continue
        usage = payload.get("usage")
        if isinstance(usage, Mapping):
            metadata["usage"] = dict(usage)
        for key in ("cost", "cost_usd", "estimated_cost", "billing"):
            value = payload.get(key)
            if value is not None and key not in metadata:
                metadata[key] = value
    metadata["cost_source"] = "provider_reported" if any(
        key in metadata for key in ("cost", "cost_usd", "estimated_cost", "billing")
    ) else "not_reported"
    return metadata


def quality_metadata(parsed: Mapping[str, Any], *, decision: str) -> dict[str, Any]:
    confidence = parsed.get("confidence")
    try:
        confidence_value = max(0.0, min(1.0, float(confidence))) if confidence is not None else None
    except (TypeError, ValueError):
        confidence_value = None
    reasons = [str(v) for v in parsed.get("reasons", []) if isinstance(v, (str, int, float))][:50]
    violations = [str(v) for v in parsed.get("canon_violations", []) if isinstance(v, (str, int, float))][:50]
    revision_prompt = str(parsed.get("revision_prompt") or "").strip()[:12000] or None
    return {
        "decision": decision,
        "confidence": confidence_value,
        "reasons": reasons,
        "canon_violations": violations,
        "revision_prompt": revision_prompt,
        "regeneration_requested": decision == "revise" and bool(revision_prompt),
    }


def regeneration_allowed(
    job: Mapping[str, Any],
    quality: Mapping[str, Any],
    environ: Mapping[str, str],
) -> bool:
    if quality.get("decision") != "revise" or not quality.get("revision_prompt"):
        return False
    if not _truthy(environ.get("AI_FILM_AUTO_REGEN_ENABLED")):
        return False
    if not _truthy(environ.get("AI_FILM_GENERATION_EXECUTION_ENABLED")):
        return False
    current = int(job.get("regeneration_count") or 0)
    try:
        maximum = max(0, int(environ.get("AI_FILM_AUTO_REGEN_MAX", "1") or 1))
    except (TypeError, ValueError):
        maximum = 1
    return current < maximum


def regeneration_packet(job: Mapping[str, Any], quality: Mapping[str, Any]) -> dict[str, Any]:
    input_payload = job.get("input") if isinstance(job.get("input"), Mapping) else {}
    packet = input_payload.get("generation_packet") if isinstance(input_payload.get("generation_packet"), Mapping) else {}
    updated = dict(packet)
    prior_prompt = str(packet.get("generation_prompt") or "").strip()
    revision = str(quality.get("revision_prompt") or "").strip()
    if revision:
        updated["generation_prompt"] = f"{prior_prompt}\nRevision requirements: {revision}".strip()
        updated["regeneration_revision_prompt"] = revision
    updated["parent_render_job_id"] = str(job.get("id") or "")
    updated["regeneration_count"] = int(job.get("regeneration_count") or 0) + 1
    return updated
