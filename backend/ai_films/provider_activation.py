"""Fail-closed activation contract for AI Films video providers.

A provider is executable only when it is explicitly requested, backed by a
known worker, and certified for production. Pollo is the current certified
baseline. Additional providers require an explicit per-provider canary pass
flag before routing can mark them executable.
"""
from __future__ import annotations

from dataclasses import dataclass
from typing import Mapping


@dataclass(frozen=True)
class ProviderActivation:
    provider: str
    requested: bool
    worker_available: bool
    canary_passed: bool
    executable: bool
    reasons: tuple[str, ...]


# These entries mean D3VONN has a concrete worker implementation in this repo.
# They do not by themselves authorize execution.
_VIDEO_WORKERS = {
    "pollo": "backend.ai_films.pollo_video_worker",
    "openai": "backend.ai_films.openai_video_worker",
    "replicate": "backend.ai_films.replicate_video_worker",
}

# Pollo has already completed the guarded production canary path. Other
# providers must present an explicit runtime canary pass before activation.
_BASELINE_CERTIFIED = {"pollo"}


def _truthy(value: object) -> bool:
    return str(value or "").strip().lower() in {"1", "true", "yes", "on", "pass", "passed"}


def _normalized_requested(source: Mapping[str, str]) -> set[str]:
    raw = str(source.get("AI_FILM_EXECUTABLE_VIDEO_PROVIDERS", "pollo"))
    aliases = {"sora": "openai", "pollo-v2-5": "pollo", "grok": "xai"}
    return {
        aliases.get(item.strip().lower(), item.strip().lower())
        for item in raw.split(",")
        if item.strip()
    }


def activation_status(provider: str, source: Mapping[str, str]) -> ProviderActivation:
    name = str(provider).strip().lower()
    requested = name in _normalized_requested(source)
    worker_available = name in _VIDEO_WORKERS
    canary_key = f"AI_FILM_PROVIDER_CANARY_{name.upper()}"
    canary_passed = name in _BASELINE_CERTIFIED or _truthy(source.get(canary_key))

    reasons: list[str] = []
    if not requested:
        reasons.append("not_requested")
    if not worker_available:
        reasons.append("worker_unavailable")
    if not canary_passed:
        reasons.append("canary_not_passed")
    if requested and worker_available and canary_passed:
        reasons.append("activation_certified")

    return ProviderActivation(
        provider=name,
        requested=requested,
        worker_available=worker_available,
        canary_passed=canary_passed,
        executable=requested and worker_available and canary_passed,
        reasons=tuple(reasons),
    )


def certified_executable_video_providers(source: Mapping[str, str]) -> set[str]:
    requested = _normalized_requested(source)
    return {
        provider
        for provider in requested
        if activation_status(provider, source).executable
    }


def known_video_workers() -> dict[str, str]:
    return dict(_VIDEO_WORKERS)
