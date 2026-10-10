"""
backend/app/security/detections/engine.py — Structured Detection Engine

Evaluates events against all active detection rules in the registry.
Handles suppression, deduplication, confidence scoring, and alert generation.
"""

from __future__ import annotations

import logging
from datetime import datetime, timedelta, timezone
from typing import Any, Optional

from .base import DETECTION_REGISTRY, DetectionRule

logger = logging.getLogger("d3vonn.detections.engine")


class StructuredDetectionEngine:
    """
    Evaluates security events against the structured detection rule registry.
    """

    def __init__(self, supabase_client: Any):
        self.db = supabase_client
        self._suppression_cache: dict[str, datetime] = {}

    async def evaluate(self, event: dict[str, Any]) -> list[dict[str, Any]]:
        """
        Evaluate an event against all active detection rules.
        Returns list of generated alerts.
        """
        alerts: list[dict[str, Any]] = []
        category = self._infer_category(event)

        # Get applicable rules
        rules = DETECTION_REGISTRY.get_active_rules(category)
        if not rules:
            rules = DETECTION_REGISTRY.get_active_rules()

        # Build context for rule evaluation
        context = await self._build_context(event)

        for rule in rules:
            try:
                # Check suppression
                cache_key = f"{rule.rule_id}:{event.get('actor', '')}:{event.get('ip', '')}"
                last_alert = self._suppression_cache.get(cache_key)
                if rule.should_suppress(last_alert):
                    continue

                # Evaluate rule
                alert = await rule.evaluate(event, context)
                if alert:
                    # Enrich alert with rule metadata
                    alert["rule_id"] = rule.rule_id
                    alert["rule_name"] = rule.name
                    alert["rule_version"] = rule.version
                    alert["severity"] = alert.get("severity", rule.severity.value)
                    alert["confidence"] = alert.get("confidence", rule.confidence)
                    alert["category"] = rule.category
                    alert["mitre_mappings"] = [
                        {"tactic_id": m.tactic_id, "technique_id": m.technique_id}
                        for m in rule.mitre_mappings
                    ]

                    # Store alert
                    stored = await self._store_alert(alert, event)
                    if stored:
                        alerts.append(stored)
                        self._suppression_cache[cache_key] = datetime.now(timezone.utc)

            except Exception as exc:
                logger.error("Rule %s evaluation failed: %s", rule.rule_id, exc)

        return alerts

    async def _build_context(self, event: dict[str, Any]) -> dict[str, Any]:
        """Build evaluation context with historical data."""
        context: dict[str, Any] = {}
        actor = event.get("actor", "")
        ip = event.get("ip", "")

        try:
            # Recent events from same actor
            window = (datetime.now(timezone.utc) - timedelta(hours=1)).isoformat()
            actor_resp = (
                self.db.table("security_events")
                .select("event_type, severity, ip, created_at")
                .eq("actor", actor)
                .gte("created_at", window)
                .order("created_at", desc=True)
                .limit(50)
                .execute()
            )
            context["actor_events"] = actor_resp.data or []
            context["actor_event_count"] = len(context["actor_events"])

            # Recent events from same IP
            if ip:
                ip_resp = (
                    self.db.table("security_events")
                    .select("actor, event_type, severity, created_at")
                    .eq("ip", ip)
                    .gte("created_at", window)
                    .order("created_at", desc=True)
                    .limit(50)
                    .execute()
                )
                context["ip_events"] = ip_resp.data or []
                context["ip_unique_actors"] = len(set(
                    e.get("actor", "") for e in context["ip_events"] if e.get("actor")
                ))

            # Recent alerts for this actor
            alert_resp = (
                self.db.table("security_alerts")
                .select("rule_id, severity, created_at")
                .eq("actor", actor)
                .gte("created_at", window)
                .limit(20)
                .execute()
            )
            context["actor_alerts"] = alert_resp.data or []

        except Exception as exc:
            logger.warning("Failed to build context: %s", exc)

        return context

    async def _store_alert(self, alert: dict[str, Any], event: dict[str, Any]) -> Optional[dict[str, Any]]:
        """Store a generated alert in the database."""
        try:
            data = {
                "rule_id": alert.get("rule_id"),
                "severity": alert.get("severity"),
                "description": alert.get("description", ""),
                "actor": event.get("actor"),
                "ip": event.get("ip"),
                "evidence": alert.get("evidence", {}),
                "confidence": alert.get("confidence", 50),
                "mitre_tactics": [m.get("tactic_id") for m in alert.get("mitre_mappings", [])],
                "mitre_techniques": [m.get("technique_id") for m in alert.get("mitre_mappings", [])],
                "status": "open",
            }
            resp = self.db.table("security_alerts").insert(data).execute()
            return resp.data[0] if resp.data else data
        except Exception as exc:
            logger.error("Failed to store alert: %s", exc)
            return None

    @staticmethod
    def _infer_category(event: dict[str, Any]) -> Optional[str]:
        """Infer the detection category from event type."""
        event_type = event.get("event_type", "")

        category_map = {
            "auth.": "authentication",
            "login": "authentication",
            "token": "authentication",
            "mfa": "authentication",
            "role": "identity",
            "privilege": "identity",
            "account": "identity",
            "api.": "api",
            "rate_limit": "api",
            "endpoint.": "endpoint",
            "network.": "network",
            "cloud.": "cloud",
            "deploy.": "cloud",
            "ai.": "ai",
            "model.": "ai",
            "payment": "fraud",
            "transaction": "fraud",
        }

        for prefix, category in category_map.items():
            if prefix in event_type:
                return category

        return None

    def get_rule_stats(self) -> dict[str, Any]:
        """Get statistics about registered rules."""
        rules = DETECTION_REGISTRY.get_all_rules()
        return {
            "total_rules": len(rules),
            "active_rules": sum(1 for r in rules if r.status.value == "active"),
            "by_category": self._count_by(rules, "category"),
            "by_severity": self._count_by_severity(rules),
            "coverage": DETECTION_REGISTRY.get_coverage_report(),
        }

    @staticmethod
    def _count_by(rules: list[DetectionRule], attr: str) -> dict[str, int]:
        counts: dict[str, int] = {}
        for rule in rules:
            val = getattr(rule, attr, "unknown")
            counts[val] = counts.get(val, 0) + 1
        return counts

    @staticmethod
    def _count_by_severity(rules: list[DetectionRule]) -> dict[str, int]:
        counts: dict[str, int] = {}
        for rule in rules:
            counts[rule.severity.value] = counts.get(rule.severity.value, 0) + 1
        return counts
