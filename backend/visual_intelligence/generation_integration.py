"""Runtime helpers for applying Visual Prompt Intelligence to generation packets."""
from __future__ import annotations

from collections.abc import Mapping, Sequence
from typing import Any

from backend.visual_intelligence.style_library import VisualStyleLibrary


def compile_for_generation(
    request: str,
    *,
    existing_negative_prompt: str | None = None,
    policy: Mapping[str, Any] | None = None,
    metadata: Mapping[str, object] | None = None,
) -> dict[str, Any]:
    """Compile a provider-neutral prompt from an orchestration generation policy.

    Expected policy shape::

        {
            "enabled": true,
            "style_id": "cinematic-storyboard",
            "constraints": ["..."],
            "negative_constraints": ["..."]
        }

    If disabled or absent, the original prompt is returned unchanged. Unknown style
    identifiers degrade safely to no-style compilation while exposing a warning in
    metadata; provider routing is never changed here.
    """
    source = dict(policy or {})
    if not source or source.get("enabled") is False:
        return {
            "generation_prompt": request,
            "negative_prompt": existing_negative_prompt,
            "visual_intelligence": {
                "enabled": False,
                "compiler": None,
                "style_id": None,
                "source": None,
                "warnings": [],
            },
        }

    style_id = _clean_scalar(source.get("style_id"))
    constraints = _clean_sequence(source.get("constraints"))
    negative_constraints = _clean_sequence(source.get("negative_constraints"))
    if existing_negative_prompt:
        negative_constraints.insert(0, existing_negative_prompt)

    library = VisualStyleLibrary()
    warnings: list[str] = []
    if style_id and library.get(style_id) is None:
        warnings.append(f"unknown_visual_style:{style_id}")
        style_id = None

    compiled = library.compile(
        request,
        style_id=style_id,
        constraints=constraints,
        negative_constraints=negative_constraints,
        metadata=metadata,
    )
    return {
        "generation_prompt": compiled.prompt,
        "negative_prompt": compiled.negative_prompt,
        "visual_intelligence": {
            "enabled": True,
            "compiler": compiled.metadata.get("compiler"),
            "style_id": compiled.style_id,
            "category": compiled.category,
            "source": compiled.source,
            "warnings": warnings,
            "metadata": dict(compiled.metadata),
        },
    }


def resolve_visual_policy(
    generation_policy: Mapping[str, Any] | None,
    *,
    shot_id: str,
) -> dict[str, Any]:
    """Resolve global visual policy plus optional per-shot overrides."""
    root = dict(generation_policy or {})
    raw = root.get("visual_intelligence")
    if not isinstance(raw, Mapping):
        return {}
    resolved = dict(raw)
    overrides = resolved.pop("shot_overrides", None)
    if isinstance(overrides, Mapping):
        shot_override = overrides.get(shot_id)
        if isinstance(shot_override, Mapping):
            resolved.update(dict(shot_override))
    return resolved


def _clean_scalar(value: object) -> str | None:
    if not isinstance(value, str):
        return None
    cleaned = " ".join(value.split())
    return cleaned or None


def _clean_sequence(value: object) -> list[str]:
    if not isinstance(value, Sequence) or isinstance(value, (str, bytes)):
        return []
    result: list[str] = []
    for item in value:
        cleaned = _clean_scalar(item)
        if cleaned:
            result.append(cleaned)
    return result
