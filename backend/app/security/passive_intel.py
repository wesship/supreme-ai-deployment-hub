"""Governed passive threat-intelligence adapters for D3VONN Security Ops."""
from __future__ import annotations

import os
from dataclasses import dataclass
from typing import Any, Literal
from urllib.parse import quote

import httpx

from backend.app.security.tool_registry import evaluate_policy

IndicatorType = Literal["ip", "domain", "url", "hash"]


class PassiveIntelError(RuntimeError):
    pass


@dataclass(frozen=True)
class PassiveIntelResult:
    provider: str
    indicator_type: IndicatorType
    indicator: str
    reputation: int | None
    malicious: int
    suspicious: int
    harmless: int
    undetected: int
    tags: list[str]
    raw_id: str | None

    def as_dict(self) -> dict[str, Any]:
        return {
            "provider": self.provider,
            "indicator_type": self.indicator_type,
            "indicator": self.indicator,
            "reputation": self.reputation,
            "malicious": self.malicious,
            "suspicious": self.suspicious,
            "harmless": self.harmless,
            "undetected": self.undetected,
            "tags": self.tags,
            "raw_id": self.raw_id,
        }


def _vt_path(indicator_type: IndicatorType, indicator: str) -> str:
    if indicator_type == "ip":
        return f"/api/v3/ip_addresses/{quote(indicator, safe='')}"
    if indicator_type == "domain":
        return f"/api/v3/domains/{quote(indicator, safe='')}"
    if indicator_type == "hash":
        return f"/api/v3/files/{quote(indicator, safe='')}"
    if indicator_type == "url":
        import base64
        url_id = base64.urlsafe_b64encode(indicator.encode()).decode().rstrip("=")
        return f"/api/v3/urls/{url_id}"
    raise PassiveIntelError("unsupported_indicator_type")


def _capability(indicator_type: IndicatorType) -> str:
    return {
        "ip": "ip_enrichment",
        "domain": "domain_enrichment",
        "url": "url_enrichment",
        "hash": "hash_enrichment",
    }[indicator_type]


async def virustotal_enrich(
    indicator_type: IndicatorType,
    indicator: str,
    *,
    api_key: str | None = None,
    client: httpx.AsyncClient | None = None,
) -> PassiveIntelResult:
    """Perform read-only VirusTotal enrichment after registry authorization."""
    value = indicator.strip()
    if not value or len(value) > 2048:
        raise PassiveIntelError("invalid_indicator")

    decision = evaluate_policy(
        tool_id="virustotal",
        capability=_capability(indicator_type),
        environment="production",
        actor="hermes",
    )
    if decision.decision != "allow":
        raise PassiveIntelError(f"policy_{decision.decision}:{decision.reason}")

    key = api_key or os.getenv("VIRUSTOTAL_API_KEY")
    if not key:
        raise PassiveIntelError("virustotal_not_configured")

    owns_client = client is None
    http = client or httpx.AsyncClient(base_url="https://www.virustotal.com", timeout=12.0)
    try:
        response = await http.get(_vt_path(indicator_type, value), headers={"x-apikey": key, "accept": "application/json"})
        if response.status_code == 404:
            raise PassiveIntelError("indicator_not_found")
        if response.status_code == 429:
            raise PassiveIntelError("provider_rate_limited")
        if response.status_code >= 400:
            raise PassiveIntelError(f"provider_http_{response.status_code}")
        payload = response.json()
    except httpx.TimeoutException as exc:
        raise PassiveIntelError("provider_timeout") from exc
    except httpx.RequestError as exc:
        raise PassiveIntelError("provider_unreachable") from exc
    finally:
        if owns_client:
            await http.aclose()

    data = payload.get("data") or {}
    attrs = data.get("attributes") or {}
    stats = attrs.get("last_analysis_stats") or {}
    return PassiveIntelResult(
        provider="virustotal",
        indicator_type=indicator_type,
        indicator=value,
        reputation=attrs.get("reputation"),
        malicious=int(stats.get("malicious", 0) or 0),
        suspicious=int(stats.get("suspicious", 0) or 0),
        harmless=int(stats.get("harmless", 0) or 0),
        undetected=int(stats.get("undetected", 0) or 0),
        tags=list(attrs.get("tags") or []),
        raw_id=data.get("id"),
    )
