"""
backend/app/security/threat_intel_v2.py — Enhanced Threat Intelligence Pipeline

Provides:
- IOC normalization and lifecycle management
- STIX/TAXII import/export support
- Indicator expiration and aging
- Reputation scoring
- Enrichment from multiple sources
- Actor tracking and profiling
- Campaign tracking and correlation
"""

from __future__ import annotations

import hashlib
import logging
from datetime import datetime, timedelta, timezone
from enum import Enum
from typing import Any, Optional

logger = logging.getLogger("d3vonn.threat_intel_v2")


# ---------------------------------------------------------------------------
# Enums and Constants
# ---------------------------------------------------------------------------

class IOCType(str, Enum):
    IP_ADDRESS = "ip_address"
    DOMAIN = "domain"
    URL = "url"
    FILE_HASH_MD5 = "file_hash_md5"
    FILE_HASH_SHA1 = "file_hash_sha1"
    FILE_HASH_SHA256 = "file_hash_sha256"
    EMAIL = "email"
    USER_AGENT = "user_agent"
    CVE = "cve"
    ASN = "asn"
    CIDR = "cidr"
    MUTEX = "mutex"
    REGISTRY_KEY = "registry_key"


class ThreatActorType(str, Enum):
    APT = "apt"
    CYBERCRIME = "cybercrime"
    HACKTIVIST = "hacktivist"
    INSIDER = "insider"
    NATION_STATE = "nation_state"
    UNKNOWN = "unknown"


class CampaignStatus(str, Enum):
    ACTIVE = "active"
    DORMANT = "dormant"
    CONCLUDED = "concluded"
    SUSPECTED = "suspected"


class IndicatorStatus(str, Enum):
    ACTIVE = "active"
    EXPIRED = "expired"
    REVOKED = "revoked"
    PENDING_REVIEW = "pending_review"


class ConfidenceLevel(str, Enum):
    HIGH = "high"
    MEDIUM = "medium"
    LOW = "low"
    UNKNOWN = "unknown"


# ---------------------------------------------------------------------------
# STIX/TAXII Support
# ---------------------------------------------------------------------------

class STIXHandler:
    """Handles STIX 2.1 object creation and parsing."""

    STIX_VERSION = "2.1"

    @staticmethod
    def create_indicator(ioc_type: IOCType, value: str, confidence: int, description: str = "") -> dict[str, Any]:
        """Create a STIX 2.1 Indicator object."""
        pattern_map = {
            IOCType.IP_ADDRESS: f"[ipv4-addr:value = '{value}']",
            IOCType.DOMAIN: f"[domain-name:value = '{value}']",
            IOCType.URL: f"[url:value = '{value}']",
            IOCType.FILE_HASH_SHA256: f"[file:hashes.'SHA-256' = '{value}']",
            IOCType.FILE_HASH_MD5: f"[file:hashes.MD5 = '{value}']",
            IOCType.EMAIL: f"[email-addr:value = '{value}']",
        }

        pattern = pattern_map.get(ioc_type, f"[x-d3vonn:{ioc_type.value} = '{value}']")

        return {
            "type": "indicator",
            "spec_version": STIXHandler.STIX_VERSION,
            "id": f"indicator--{hashlib.sha256(f'{ioc_type.value}:{value}'.encode()).hexdigest()[:36]}",
            "created": datetime.now(timezone.utc).isoformat(),
            "modified": datetime.now(timezone.utc).isoformat(),
            "name": f"{ioc_type.value}: {value}",
            "description": description,
            "pattern": pattern,
            "pattern_type": "stix",
            "valid_from": datetime.now(timezone.utc).isoformat(),
            "confidence": confidence,
            "labels": [ioc_type.value],
        }

    @staticmethod
    def create_threat_actor(name: str, actor_type: ThreatActorType, aliases: list[str] = None, description: str = "") -> dict[str, Any]:
        """Create a STIX 2.1 Threat Actor object."""
        return {
            "type": "threat-actor",
            "spec_version": STIXHandler.STIX_VERSION,
            "id": f"threat-actor--{hashlib.sha256(name.encode()).hexdigest()[:36]}",
            "created": datetime.now(timezone.utc).isoformat(),
            "modified": datetime.now(timezone.utc).isoformat(),
            "name": name,
            "description": description,
            "threat_actor_types": [actor_type.value],
            "aliases": aliases or [],
            "sophistication": "expert" if actor_type == ThreatActorType.APT else "intermediate",
        }

    @staticmethod
    def create_campaign(name: str, description: str = "", first_seen: str = "", last_seen: str = "") -> dict[str, Any]:
        """Create a STIX 2.1 Campaign object."""
        return {
            "type": "campaign",
            "spec_version": STIXHandler.STIX_VERSION,
            "id": f"campaign--{hashlib.sha256(name.encode()).hexdigest()[:36]}",
            "created": datetime.now(timezone.utc).isoformat(),
            "modified": datetime.now(timezone.utc).isoformat(),
            "name": name,
            "description": description,
            "first_seen": first_seen or datetime.now(timezone.utc).isoformat(),
            "last_seen": last_seen or datetime.now(timezone.utc).isoformat(),
        }

    @staticmethod
    def create_relationship(source_id: str, target_id: str, relationship_type: str) -> dict[str, Any]:
        """Create a STIX 2.1 Relationship object."""
        return {
            "type": "relationship",
            "spec_version": STIXHandler.STIX_VERSION,
            "id": f"relationship--{hashlib.sha256(f'{source_id}:{target_id}'.encode()).hexdigest()[:36]}",
            "created": datetime.now(timezone.utc).isoformat(),
            "relationship_type": relationship_type,
            "source_ref": source_id,
            "target_ref": target_id,
        }

    @staticmethod
    def create_bundle(objects: list[dict[str, Any]]) -> dict[str, Any]:
        """Create a STIX 2.1 Bundle."""
        return {
            "type": "bundle",
            "id": f"bundle--{hashlib.sha256(str(len(objects)).encode()).hexdigest()[:36]}",
            "objects": objects,
        }

    @staticmethod
    def parse_stix_bundle(bundle: dict[str, Any]) -> list[dict[str, Any]]:
        """Parse a STIX bundle and extract objects."""
        if bundle.get("type") != "bundle":
            raise ValueError("Invalid STIX bundle")
        return bundle.get("objects", [])


class TAXIIClient:
    """TAXII 2.1 client for feed synchronization."""

    def __init__(self, server_url: str, api_root: str = "", username: str = "", password: str = ""):
        self.server_url = server_url.rstrip("/")
        self.api_root = api_root
        self.username = username
        self.password = password

    async def discover(self) -> dict[str, Any]:
        """Discover TAXII server capabilities."""
        # Stub: would make HTTP request to {server_url}/taxii2/
        return {
            "title": "D3VONN TAXII Server",
            "api_roots": [f"{self.server_url}/api/v21/"],
            "default": f"{self.server_url}/api/v21/",
        }

    async def get_collections(self) -> list[dict[str, Any]]:
        """List available collections."""
        # Stub: would query {api_root}/collections/
        return [
            {"id": "collection-001", "title": "D3VONN IOCs", "can_read": True, "can_write": True},
            {"id": "collection-002", "title": "Threat Actors", "can_read": True, "can_write": False},
            {"id": "collection-003", "title": "Campaigns", "can_read": True, "can_write": False},
        ]

    async def get_objects(self, collection_id: str, added_after: str = "") -> dict[str, Any]:
        """Get objects from a collection."""
        # Stub: would query {api_root}/collections/{id}/objects/
        return {"type": "bundle", "objects": []}

    async def add_objects(self, collection_id: str, bundle: dict[str, Any]) -> dict[str, Any]:
        """Add objects to a collection."""
        # Stub: would POST to {api_root}/collections/{id}/objects/
        return {"id": "status-001", "status": "complete", "total_count": len(bundle.get("objects", []))}


# ---------------------------------------------------------------------------
# Enhanced Threat Intelligence Pipeline
# ---------------------------------------------------------------------------

class ThreatIntelPipeline:
    """
    Enhanced threat intelligence pipeline with full lifecycle management.
    """

    def __init__(self, supabase_client: Any):
        self.db = supabase_client
        self.stix = STIXHandler()
        self._enrichment_sources: list[dict[str, Any]] = []

    # -----------------------------------------------------------------------
    # IOC Management
    # -----------------------------------------------------------------------

    async def ingest_ioc(
        self,
        ioc_type: IOCType,
        value: str,
        source: str,
        confidence: int = 50,
        tags: list[str] = None,
        ttl_days: int = 90,
        context: dict[str, Any] = None,
    ) -> dict[str, Any]:
        """Ingest and normalize a new IOC."""
        normalized_value = self._normalize_ioc(ioc_type, value)
        expires_at = (datetime.now(timezone.utc) + timedelta(days=ttl_days)).isoformat()

        ioc_data = {
            "ioc_type": ioc_type.value,
            "value": normalized_value,
            "source": source,
            "confidence": confidence,
            "status": IndicatorStatus.ACTIVE.value,
            "tags": tags or [],
            "expires_at": expires_at,
            "context": context or {},
            "first_seen": datetime.now(timezone.utc).isoformat(),
            "last_seen": datetime.now(timezone.utc).isoformat(),
            "sightings": 1,
        }

        try:
            # Check for existing IOC
            existing = (
                self.db.table("security_threat_iocs")
                .select("id, sightings, confidence")
                .eq("ioc_type", ioc_type.value)
                .eq("value", normalized_value)
                .limit(1)
                .execute()
            )

            if existing.data:
                # Update existing: increment sightings, update confidence
                ioc_id = existing.data[0]["id"]
                new_sightings = existing.data[0]["sightings"] + 1
                new_confidence = min(100, max(existing.data[0]["confidence"], confidence))
                self.db.table("security_threat_iocs").update({
                    "sightings": new_sightings,
                    "confidence": new_confidence,
                    "last_seen": datetime.now(timezone.utc).isoformat(),
                }).eq("id", ioc_id).execute()
                ioc_data["id"] = ioc_id
            else:
                resp = self.db.table("security_threat_iocs").insert(ioc_data).execute()
                if resp.data:
                    ioc_data["id"] = resp.data[0].get("id")

        except Exception as exc:
            logger.error("Failed to ingest IOC: %s", exc)

        return ioc_data

    async def check_ioc(self, ioc_type: IOCType, value: str) -> Optional[dict[str, Any]]:
        """Check if a value matches any known IOC."""
        normalized = self._normalize_ioc(ioc_type, value)
        try:
            resp = (
                self.db.table("security_threat_iocs")
                .select("*")
                .eq("ioc_type", ioc_type.value)
                .eq("value", normalized)
                .eq("status", IndicatorStatus.ACTIVE.value)
                .limit(1)
                .execute()
            )
            if resp.data:
                # Update last_seen
                self.db.table("security_threat_iocs").update({
                    "last_seen": datetime.now(timezone.utc).isoformat(),
                    "sightings": resp.data[0].get("sightings", 0) + 1,
                }).eq("id", resp.data[0]["id"]).execute()
                return resp.data[0]
        except Exception as exc:
            logger.warning("IOC check failed: %s", exc)
        return None

    async def expire_stale_iocs(self) -> int:
        """Expire IOCs that have passed their TTL."""
        now = datetime.now(timezone.utc).isoformat()
        try:
            resp = (
                self.db.table("security_threat_iocs")
                .update({"status": IndicatorStatus.EXPIRED.value})
                .eq("status", IndicatorStatus.ACTIVE.value)
                .lt("expires_at", now)
                .execute()
            )
            count = len(resp.data) if resp.data else 0
            logger.info("Expired %d stale IOCs", count)
            return count
        except Exception as exc:
            logger.error("Failed to expire IOCs: %s", exc)
            return 0

    # -----------------------------------------------------------------------
    # Reputation Scoring
    # -----------------------------------------------------------------------

    async def compute_reputation(self, ioc_type: IOCType, value: str) -> dict[str, Any]:
        """Compute a reputation score for an indicator."""
        normalized = self._normalize_ioc(ioc_type, value)
        score = 50  # Neutral baseline
        factors: list[dict[str, Any]] = []

        try:
            # Check internal IOC database
            ioc = await self.check_ioc(ioc_type, normalized)
            if ioc:
                score -= 30  # Known bad indicator
                factors.append({"source": "internal_ioc_db", "impact": -30, "detail": f"Confidence: {ioc.get('confidence')}"})

            # Check alert history
            if ioc_type == IOCType.IP_ADDRESS:
                alerts = (
                    self.db.table("security_alerts")
                    .select("id", count="exact")
                    .eq("ip", normalized)
                    .execute()
                )
                alert_count = alerts.count or 0
                if alert_count > 0:
                    penalty = min(alert_count * 5, 30)
                    score -= penalty
                    factors.append({"source": "alert_history", "impact": -penalty, "detail": f"{alert_count} alerts"})

            # Check event frequency
            events = (
                self.db.table("security_events")
                .select("id", count="exact")
                .eq("ip", normalized)
                .gte("created_at", (datetime.now(timezone.utc) - timedelta(days=7)).isoformat())
                .execute()
            )
            event_count = events.count or 0
            if event_count > 100:
                penalty = min((event_count - 100) // 10, 20)
                score -= penalty
                factors.append({"source": "event_frequency", "impact": -penalty, "detail": f"{event_count} events in 7d"})

        except Exception as exc:
            logger.warning("Reputation computation error: %s", exc)

        return {
            "ioc_type": ioc_type.value,
            "value": normalized,
            "reputation_score": max(0, min(100, score)),
            "verdict": self._score_to_verdict(score),
            "factors": factors,
            "computed_at": datetime.now(timezone.utc).isoformat(),
        }

    # -----------------------------------------------------------------------
    # Actor Tracking
    # -----------------------------------------------------------------------

    async def track_actor(
        self,
        name: str,
        actor_type: ThreatActorType,
        aliases: list[str] = None,
        ttps: list[str] = None,
        targets: list[str] = None,
        description: str = "",
    ) -> dict[str, Any]:
        """Create or update a threat actor profile."""
        actor_data = {
            "name": name,
            "actor_type": actor_type.value,
            "aliases": aliases or [],
            "ttps": ttps or [],
            "targets": targets or [],
            "description": description,
            "first_seen": datetime.now(timezone.utc).isoformat(),
            "last_seen": datetime.now(timezone.utc).isoformat(),
            "status": "active",
        }

        try:
            existing = (
                self.db.table("security_threat_actors")
                .select("id")
                .eq("name", name)
                .limit(1)
                .execute()
            )

            if existing.data:
                self.db.table("security_threat_actors").update({
                    "last_seen": datetime.now(timezone.utc).isoformat(),
                    "aliases": aliases or [],
                    "ttps": ttps or [],
                }).eq("id", existing.data[0]["id"]).execute()
                actor_data["id"] = existing.data[0]["id"]
            else:
                resp = self.db.table("security_threat_actors").insert(actor_data).execute()
                if resp.data:
                    actor_data["id"] = resp.data[0].get("id")
        except Exception as exc:
            logger.error("Failed to track actor: %s", exc)

        return actor_data

    # -----------------------------------------------------------------------
    # Campaign Tracking
    # -----------------------------------------------------------------------

    async def track_campaign(
        self,
        name: str,
        actor_name: str = "",
        objectives: list[str] = None,
        iocs: list[str] = None,
        ttps: list[str] = None,
        description: str = "",
    ) -> dict[str, Any]:
        """Create or update a campaign."""
        campaign_data = {
            "name": name,
            "actor_name": actor_name,
            "status": CampaignStatus.ACTIVE.value,
            "objectives": objectives or [],
            "iocs": iocs or [],
            "ttps": ttps or [],
            "description": description,
            "first_seen": datetime.now(timezone.utc).isoformat(),
            "last_seen": datetime.now(timezone.utc).isoformat(),
        }

        try:
            existing = (
                self.db.table("security_campaigns")
                .select("id")
                .eq("name", name)
                .limit(1)
                .execute()
            )

            if existing.data:
                self.db.table("security_campaigns").update({
                    "last_seen": datetime.now(timezone.utc).isoformat(),
                    "status": CampaignStatus.ACTIVE.value,
                }).eq("id", existing.data[0]["id"]).execute()
                campaign_data["id"] = existing.data[0]["id"]
            else:
                resp = self.db.table("security_campaigns").insert(campaign_data).execute()
                if resp.data:
                    campaign_data["id"] = resp.data[0].get("id")
        except Exception as exc:
            logger.error("Failed to track campaign: %s", exc)

        return campaign_data

    # -----------------------------------------------------------------------
    # STIX/TAXII Integration
    # -----------------------------------------------------------------------

    async def export_as_stix_bundle(self, ioc_types: list[IOCType] = None, limit: int = 100) -> dict[str, Any]:
        """Export IOCs as a STIX 2.1 bundle."""
        objects: list[dict[str, Any]] = []

        try:
            query = self.db.table("security_threat_iocs").select("*").eq("status", "active").limit(limit)
            if ioc_types:
                query = query.in_("ioc_type", [t.value for t in ioc_types])
            resp = query.execute()

            for ioc in (resp.data or []):
                stix_obj = self.stix.create_indicator(
                    IOCType(ioc["ioc_type"]),
                    ioc["value"],
                    ioc.get("confidence", 50),
                    description=f"Source: {ioc.get('source', 'unknown')}",
                )
                objects.append(stix_obj)
        except Exception as exc:
            logger.error("STIX export failed: %s", exc)

        return self.stix.create_bundle(objects)

    async def import_stix_bundle(self, bundle: dict[str, Any], source: str = "taxii_feed") -> dict[str, Any]:
        """Import IOCs from a STIX 2.1 bundle."""
        objects = self.stix.parse_stix_bundle(bundle)
        imported = 0
        errors = 0

        for obj in objects:
            if obj.get("type") == "indicator":
                try:
                    pattern = obj.get("pattern", "")
                    ioc_type, value = self._parse_stix_pattern(pattern)
                    if ioc_type and value:
                        await self.ingest_ioc(
                            ioc_type=ioc_type,
                            value=value,
                            source=source,
                            confidence=obj.get("confidence", 50),
                            tags=obj.get("labels", []),
                        )
                        imported += 1
                except Exception:
                    errors += 1

        return {"imported": imported, "errors": errors, "total": len(objects)}

    async def sync_taxii_feed(self, server_url: str, collection_id: str, api_root: str = "") -> dict[str, Any]:
        """Synchronize with a TAXII feed."""
        client = TAXIIClient(server_url, api_root)
        try:
            bundle = await client.get_objects(collection_id)
            result = await self.import_stix_bundle(bundle, source=f"taxii:{server_url}")
            return {"status": "success", **result}
        except Exception as exc:
            return {"status": "error", "error": str(exc)}

    # -----------------------------------------------------------------------
    # Enrichment
    # -----------------------------------------------------------------------

    async def enrich_ip(self, ip: str) -> dict[str, Any]:
        """Enrich an IP address with threat intelligence."""
        enrichment: dict[str, Any] = {
            "ip": ip,
            "enriched_at": datetime.now(timezone.utc).isoformat(),
        }

        # Check internal IOC database
        ioc_match = await self.check_ioc(IOCType.IP_ADDRESS, ip)
        if ioc_match:
            enrichment["internal_match"] = True
            enrichment["confidence"] = ioc_match.get("confidence", 0)
            enrichment["tags"] = ioc_match.get("tags", [])
            enrichment["first_seen"] = ioc_match.get("first_seen")

        # Compute reputation
        reputation = await self.compute_reputation(IOCType.IP_ADDRESS, ip)
        enrichment["reputation"] = reputation

        # Check for associated actors
        try:
            actors = (
                self.db.table("security_threat_actors")
                .select("name, actor_type")
                .contains("iocs", [ip])
                .execute()
            )
            enrichment["associated_actors"] = actors.data or []
        except Exception:
            enrichment["associated_actors"] = []

        return enrichment

    # -----------------------------------------------------------------------
    # Helpers
    # -----------------------------------------------------------------------

    @staticmethod
    def _normalize_ioc(ioc_type: IOCType, value: str) -> str:
        """Normalize an IOC value."""
        value = value.strip()
        if ioc_type == IOCType.IP_ADDRESS:
            return value
        if ioc_type == IOCType.DOMAIN:
            return value.lower().rstrip(".")
        if ioc_type == IOCType.URL:
            return value.lower()
        if ioc_type == IOCType.EMAIL:
            return value.lower()
        if ioc_type in (IOCType.FILE_HASH_MD5, IOCType.FILE_HASH_SHA1, IOCType.FILE_HASH_SHA256):
            return value.lower()
        return value

    @staticmethod
    def _score_to_verdict(score: int) -> str:
        """Convert reputation score to verdict."""
        if score <= 20:
            return "malicious"
        if score <= 40:
            return "suspicious"
        if score <= 60:
            return "neutral"
        if score <= 80:
            return "benign"
        return "trusted"

    @staticmethod
    def _parse_stix_pattern(pattern: str) -> tuple[Optional[IOCType], Optional[str]]:
        """Parse a STIX pattern to extract IOC type and value."""
        pattern_map = {
            "ipv4-addr:value": IOCType.IP_ADDRESS,
            "domain-name:value": IOCType.DOMAIN,
            "url:value": IOCType.URL,
            "file:hashes.'SHA-256'": IOCType.FILE_HASH_SHA256,
            "file:hashes.MD5": IOCType.FILE_HASH_MD5,
            "email-addr:value": IOCType.EMAIL,
        }

        for stix_key, ioc_type in pattern_map.items():
            if stix_key in pattern:
                # Extract value between quotes
                parts = pattern.split("'")
                if len(parts) >= 2:
                    return ioc_type, parts[-2]
        return None, None
