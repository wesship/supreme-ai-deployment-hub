"""HealthOS sandbox dependency readiness checks."""
from dataclasses import dataclass
from typing import Awaitable, Callable

import httpx

from backend.healthos.settings import HealthOSSettings


@dataclass(frozen=True)
class DependencyStatus:
    name: str
    enabled: bool
    configured: bool
    healthy: bool
    required: bool
    detail: str


async def _http_ok(url: str, timeout: float = 3.0) -> bool:
    try:
        async with httpx.AsyncClient(timeout=timeout, follow_redirects=True) as client:
            response = await client.get(url)
        return response.status_code < 500
    except Exception:
        return False


async def check_healthos_dependencies(
    settings: HealthOSSettings,
    http_probe: Callable[[str], Awaitable[bool]] = _http_ok,
) -> dict[str, DependencyStatus]:
    specs = {
        "fhir": (settings.fhir_enabled, settings.fhir_base_url, True),
        "policy": (settings.policy_enabled, settings.policy_url, True),
        "ehr": (settings.ehr_enabled, settings.ehr_base_url, False),
        "integration_engine": (
            settings.integration_engine_enabled,
            settings.integration_engine_url,
            False,
        ),
    }
    result: dict[str, DependencyStatus] = {}
    for name, (enabled, url, required) in specs.items():
        configured = bool(url)
        healthy = False
        detail = "disabled"
        if enabled and not configured:
            detail = "enabled_but_unconfigured"
        elif enabled and configured:
            healthy = await http_probe(url)
            detail = "reachable" if healthy else "unreachable"
        result[name] = DependencyStatus(
            name=name,
            enabled=enabled,
            configured=configured,
            healthy=healthy,
            required=required,
            detail=detail,
        )

    temporal_configured = bool(settings.temporal_target)
    result["temporal"] = DependencyStatus(
        name="temporal",
        enabled=settings.temporal_enabled,
        configured=temporal_configured,
        healthy=settings.temporal_enabled and temporal_configured,
        required=True,
        detail=(
            "configured"
            if settings.temporal_enabled and temporal_configured
            else "enabled_but_unconfigured"
            if settings.temporal_enabled
            else "disabled"
        ),
    )
    return result


def sandbox_ready(statuses: dict[str, DependencyStatus]) -> bool:
    return all(
        item.enabled and item.configured and item.healthy
        for item in statuses.values()
        if item.required
    )
