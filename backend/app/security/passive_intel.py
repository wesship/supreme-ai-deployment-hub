"""Governed passive threat-intelligence adapters for D3VONN Security Ops."""
from __future__ import annotations

import hashlib
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


def _indicator_fingerprint(indicator: str) -> str:
    return hashlib.sha256(indicator.encode("utf-8")).hexdigest()


def _start_audit(db: Any, indicator_type: IndicatorType, indicator: str) -> str:
    """Persist pending audit state before any provider request can leave D3VONN."""
    fingerprint = _indicator_fingerprint(indicator)
    action_record = {
        "alert_id": None,
        "action_type": "passive_intel_enrichment",
        "parameters": {
            "tool_id": "virustotal",
            "capability": _capability(indicator_type),
            "activity_class": "passive",
            "indicator_type": indicator_type,
            "indicator_sha256": fingerprint,
            "active_scan": False,
            "automated": True,
        },
        "result": "pending",
        "agent_version": "cyber-tool-registry-v0.1",
    }
    try:
        action_resp = db.table("hermes_security_actions").insert(action_record).execute()
        action = (action_resp.data or [None])[0]
        action_id = action.get("id") if isinstance(action, dict) else None
        if not action_id:
            raise PassiveIntelError("audit_unavailable")

        event_resp = db.table("security_events").insert(
            {
                "source": "cyber-tool-registry",
                "event_type": "security.tool.passive_enrichment_requested",
                "severity": "info",
                "actor": "hermes-security-agent",
                "metadata": {
                    "tool_id": "virustotal",
                    "capability": _capability(indicator_type),
                    "activity_class": "passive",
                    "indicator_type": indicator_type,
                    "indicator_sha256": fingerprint,
                    "action_id": str(action_id),
                    "active_scan": False,
                },
                "outcome": "unknown",
            }
        ).execute()
        if not event_resp.data:
            db.table("hermes_security_actions").update({"result": "failure"}).eq("id", str(action_id)).execute()
            raise PassiveIntelError("audit_unavailable")
        return str(action_id)
    except PassiveIntelError:
        raise
    except Exception as exc:
        raise PassiveIntelError("audit_unavailable") from exc


def _finish_audit(
    db: Any,
    *,
    action_id: str,
    indicator_type: IndicatorType,
    indicator: str,
    success: bool,
    result: PassiveIntelResult | None = None,
    error: str | None = None,
) -> None:
    fingerprint = _indicator_fingerprint(indicator)
    outcome = "success" if success else "failure"
    severity = "info"
    if result and (result.malicious > 0 or result.suspicious > 0):
        severity = "medium"

    metadata: dict[str, Any] = {
        "tool_id": "virustotal",
        "capability": _capability(indicator_type),
        "activity_class": "passive",
        "indicator_type": indicator_type,
        "indicator_sha256": fingerprint,
        "action_id": action_id,
        "active_scan": False,
    }
    if result:
        metadata.update(
            {
                "reputation": result.reputation,
                "malicious": result.malicious,
                "suspicious": result.suspicious,
                "harmless": result.harmless,
                "undetected": result.undetected,
                "tags": result.tags,
                "provider_object_id": result.raw_id,
            }
        )
    if error:
        metadata["error"] = error[:160]

    try:
        update_resp = (
            db.table("hermes_security_actions")
            .update({"result": outcome})
            .eq("id", action_id)
            .execute()
        )
        if not update_resp.data:
            raise PassiveIntelError("audit_finalize_failed")

        event_resp = db.table("security_events").insert(
            {
                "source": "cyber-tool-registry",
                "event_type": "security.tool.passive_enrichment_completed",
                "severity": severity,
                "actor": "hermes-security-agent",
                "metadata": metadata,
                "outcome": outcome,
            }
        ).execute()
        if not event_resp.data:
            raise PassiveIntelError("audit_finalize_failed")
    except PassiveIntelError:
        raise
    except Exception as exc:
        raise PassiveIntelError("audit_finalize_failed") from exc


async def virustotal_enrich(
    indicator_type: IndicatorType,
    indicator: str,
    *,
    api_key: str | None = None,
    client: httpx.AsyncClient | None = None,
    audit_db: Any | None = None,
) -> PassiveIntelResult:
    """Perform read-only VirusTotal enrichment after registry authorization and audit setup."""
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
    if audit_db is None:
        raise PassiveIntelError("audit_not_configured")

    action_id = _start_audit(audit_db, indicator_type, value)

    owns_client = client is None
    http = client or httpx.AsyncClient(base_url="https://www.virustotal.com", timeout=12.0)
    try:
        response = await http.get(
            _vt_path(indicator_type, value),
            headers={"x-apikey": key, "accept": "application/json"},
        )
        if response.status_code == 404:
            raise PassiveIntelError("indicator_not_found")
        if response.status_code == 429:
            raise PassiveIntelError("provider_rate_limited")
        if response.status_code >= 400:
            raise PassiveIntelError(f"provider_http_{response.status_code}")
        payload = response.json()

        data = payload.get("data") or {}
        attrs = data.get("attributes") or {}
        stats = attrs.get("last_analysis_stats") or {}
        result = PassiveIntelResult(
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
        _finish_audit(
            audit_db,
            action_id=action_id,
            indicator_type=indicator_type,
            indicator=value,
            success=True,
            result=result,
        )
        return result
    except httpx.TimeoutException as exc:
        try:
            _finish_audit(
                audit_db,
                action_id=action_id,
                indicator_type=indicator_type,
                indicator=value,
                success=False,
                error="provider_timeout",
            )
        finally:
            raise PassiveIntelError("provider_timeout") from exc
    except httpx.RequestError as exc:
        try:
            _finish_audit(
                audit_db,
                action_id=action_id,
                indicator_type=indicator_type,
                indicator=value,
                success=False,
                error="provider_unreachable",
            )
        finally:
            raise PassiveIntelError("provider_unreachable") from exc
    except PassiveIntelError as exc:
        if str(exc) not in {"audit_finalize_failed"}:
            _finish_audit(
                audit_db,
                action_id=action_id,
                indicator_type=indicator_type,
                indicator=value,
                success=False,
                error=str(exc),
            )
        raise
    finally:
        if owns_client:
            await http.aclose()
