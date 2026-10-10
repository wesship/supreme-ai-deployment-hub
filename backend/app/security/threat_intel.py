"""
backend/app/security/threat_intel.py — Threat Intelligence Layer

Enriches security events with external threat context:
- IP reputation and geolocation
- ASN and organization lookup
- VPN/Tor/Proxy detection
- Abuse reputation scoring
- WHOIS data
- Reverse DNS
- Historical attack associations
- IOC matching

In production, connects to:
- AbuseIPDB
- VirusTotal
- Shodan
- GreyNoise
- MaxMind GeoIP
- MITRE CVE feeds
"""

from __future__ import annotations

import logging
from datetime import datetime, timedelta, timezone
from typing import Any, Optional

logger = logging.getLogger("d3vonn.threat_intel")


class ThreatIntelligenceLayer:
    """
    Provides threat intelligence enrichment for security events.
    """

    def __init__(self, supabase_client: Any):
        self.db = supabase_client

    async def enrich_ip(self, ip: str) -> dict[str, Any]:
        """
        Enrich an IP address with all available threat intelligence.
        Returns a comprehensive enrichment result.
        """
        enrichment: dict[str, Any] = {
            "ip": ip,
            "enriched_at": datetime.now(timezone.utc).isoformat(),
        }

        # Check local cache first
        cached = await self._get_cached_ip(ip)
        if cached:
            enrichment.update(cached)
            enrichment["source"] = "cache"
        else:
            # In production: call external APIs (AbuseIPDB, VirusTotal, etc.)
            # For now, create a new entry
            enrichment.update(await self._create_ip_record(ip))
            enrichment["source"] = "new"

        # Check IOC matches
        ioc_matches = await self._check_ioc_matches("ip", ip)
        enrichment["ioc_matches"] = ioc_matches
        enrichment["is_known_threat"] = len(ioc_matches) > 0

        # Compute threat level
        enrichment["threat_level"] = self._compute_threat_level(enrichment)

        return enrichment

    async def enrich_event(self, event: dict[str, Any]) -> dict[str, Any]:
        """
        Enrich a security event with threat intelligence context.
        """
        enrichment: dict[str, Any] = {"event_id": event.get("id")}

        # Enrich IP if present
        ip = event.get("ip") or event.get("ip_address")
        if ip:
            ip_enrichment = await self.enrich_ip(str(ip))
            enrichment["ip_intel"] = ip_enrichment

        # Check actor against IOCs
        actor = event.get("actor") or event.get("actor_email")
        if actor:
            actor_iocs = await self._check_ioc_matches("email", actor)
            enrichment["actor_iocs"] = actor_iocs

        return enrichment

    async def sync_threat_feeds(self) -> dict[str, Any]:
        """
        Sync all enabled threat feeds.
        In production, this would fetch from external URLs.
        Returns sync status.
        """
        try:
            resp = (
                self.db.table("security_threat_feeds")
                .select("*")
                .eq("enabled", True)
                .execute()
            )
            feeds = resp.data or []
        except Exception:
            feeds = []

        results: dict[str, Any] = {
            "feeds_processed": 0,
            "iocs_added": 0,
            "errors": [],
        }

        for feed in feeds:
            try:
                # Stub: In production, fetch feed URL and parse IOCs
                feed_result = await self._sync_single_feed(feed)
                results["feeds_processed"] += 1
                results["iocs_added"] += feed_result.get("new_iocs", 0)

                # Update last_synced
                self.db.table("security_threat_feeds").update({
                    "last_synced": datetime.now(timezone.utc).isoformat(),
                }).eq("id", feed["id"]).execute()

            except Exception as exc:
                results["errors"].append({
                    "feed": feed.get("name"),
                    "error": str(exc),
                })

        return results

    async def _get_cached_ip(self, ip: str) -> Optional[dict[str, Any]]:
        """Get cached IP intelligence data."""
        try:
            resp = (
                self.db.table("security_ip_history")
                .select("*")
                .eq("ip", ip)
                .limit(1)
                .execute()
            )
            if resp.data:
                record = resp.data[0]
                # Check if cache is still fresh (24h)
                last_seen = record.get("last_seen")
                if last_seen:
                    last_dt = datetime.fromisoformat(last_seen.replace("Z", "+00:00"))
                    if datetime.now(timezone.utc) - last_dt < timedelta(hours=24):
                        return {
                            "asn": record.get("asn"),
                            "organization": record.get("organization"),
                            "country": record.get("country"),
                            "city": record.get("city"),
                            "is_vpn": record.get("is_vpn", False),
                            "is_tor": record.get("is_tor", False),
                            "is_proxy": record.get("is_proxy", False),
                            "abuse_score": record.get("abuse_score", 0),
                            "reverse_dns": record.get("reverse_dns"),
                            "whois_data": record.get("whois_data", {}),
                            "event_count": record.get("event_count", 0),
                            "first_seen": record.get("first_seen"),
                            "last_seen": record.get("last_seen"),
                        }
        except Exception:
            pass
        return None

    async def _create_ip_record(self, ip: str) -> dict[str, Any]:
        """Create a new IP history record (stub — would call external APIs)."""
        record = {
            "asn": None,
            "organization": None,
            "country": None,
            "is_vpn": False,
            "is_tor": False,
            "is_proxy": False,
            "abuse_score": 0,
            "reverse_dns": None,
            "event_count": 1,
        }

        try:
            self.db.table("security_ip_history").insert({
                "ip": ip,
                **record,
                "first_seen": datetime.now(timezone.utc).isoformat(),
                "last_seen": datetime.now(timezone.utc).isoformat(),
            }).execute()
        except Exception:
            pass

        return record

    async def _check_ioc_matches(self, ioc_type: str, value: str) -> list[dict[str, Any]]:
        """Check if a value matches any IOCs."""
        try:
            resp = (
                self.db.table("security_iocs")
                .select("id, ioc_type, value, severity, confidence, tags, description")
                .eq("ioc_type", ioc_type)
                .eq("value", value)
                .execute()
            )
            return resp.data or []
        except Exception:
            return []

    async def _sync_single_feed(self, feed: dict[str, Any]) -> dict[str, Any]:
        """
        Sync a single threat feed.
        Stub implementation — in production would:
        1. Fetch feed URL
        2. Parse format (JSON, CSV, STIX)
        3. Upsert IOCs into security_iocs table
        """
        # Placeholder result
        return {"new_iocs": 0, "updated_iocs": 0}

    @staticmethod
    def _compute_threat_level(enrichment: dict[str, Any]) -> str:
        """Compute overall threat level from enrichment data."""
        score = 0

        if enrichment.get("is_known_threat"):
            score += 40
        if enrichment.get("is_tor"):
            score += 30
        if enrichment.get("is_proxy"):
            score += 15
        if enrichment.get("is_vpn"):
            score += 10

        abuse = enrichment.get("abuse_score", 0)
        score += int(abuse * 0.3)

        if score >= 70:
            return "critical"
        elif score >= 50:
            return "high"
        elif score >= 30:
            return "medium"
        elif score >= 10:
            return "low"
        return "none"

    async def get_feed_status(self) -> list[dict[str, Any]]:
        """Get status of all threat feeds."""
        try:
            resp = (
                self.db.table("security_threat_feeds")
                .select("*")
                .order("name")
                .execute()
            )
            return resp.data or []
        except Exception:
            return []

    async def add_ioc(self, ioc_type: str, value: str, severity: str = "medium", **kwargs) -> dict[str, Any]:
        """Manually add an IOC."""
        try:
            resp = self.db.table("security_iocs").insert({
                "ioc_type": ioc_type,
                "value": value,
                "severity": severity,
                "confidence": kwargs.get("confidence", 80),
                "description": kwargs.get("description", ""),
                "tags": kwargs.get("tags", []),
            }).execute()
            return {"status": "success", "ioc": resp.data[0] if resp.data else None}
        except Exception as exc:
            return {"status": "error", "error": str(exc)}
