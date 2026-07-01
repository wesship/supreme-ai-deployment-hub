"""
backend/app/security/detections/base.py — Detection Rule Framework

Provides the base class for all detection rules and a registry for managing them.
"""

from __future__ import annotations

import logging
from abc import ABC, abstractmethod
from dataclasses import dataclass, field
from datetime import datetime, timedelta, timezone
from enum import Enum
from typing import Any, Optional

logger = logging.getLogger("d3vonn.detections")


class RuleStatus(str, Enum):
    DRAFT = "draft"
    TESTING = "testing"
    ACTIVE = "active"
    DEPRECATED = "deprecated"
    DISABLED = "disabled"


class RuleSeverity(str, Enum):
    CRITICAL = "critical"
    HIGH = "high"
    MEDIUM = "medium"
    LOW = "low"
    INFORMATIONAL = "informational"


@dataclass
class MitreMapping:
    """MITRE ATT&CK mapping for a detection rule."""
    tactic_id: str
    tactic_name: str
    technique_id: str
    technique_name: str
    subtechnique_id: Optional[str] = None
    subtechnique_name: Optional[str] = None


@dataclass
class SuppressionConfig:
    """Suppression configuration for a detection rule."""
    cooldown_seconds: int = 300
    deduplicate_by: list[str] = field(default_factory=lambda: ["actor", "event_type"])
    max_alerts_per_hour: int = 10


@dataclass
class DetectionRule(ABC):
    """
    Base class for all detection rules.
    Subclass this to implement specific detection logic.
    """
    rule_id: str
    name: str
    description: str
    version: str  # Semantic version: "1.0.0"
    category: str  # authentication, identity, endpoint, api, network, cloud, ai, fraud
    severity: RuleSeverity
    confidence: int  # 0-100
    status: RuleStatus = RuleStatus.ACTIVE
    mitre_mappings: list[MitreMapping] = field(default_factory=list)
    suppression: SuppressionConfig = field(default_factory=SuppressionConfig)
    tags: list[str] = field(default_factory=list)
    author: str = "d3vonn_security"
    created_at: str = ""
    updated_at: str = ""
    references: list[str] = field(default_factory=list)
    false_positive_guidance: str = ""

    def __post_init__(self):
        if not self.created_at:
            self.created_at = datetime.now(timezone.utc).isoformat()
        if not self.updated_at:
            self.updated_at = self.created_at

    @abstractmethod
    async def evaluate(self, event: dict[str, Any], context: dict[str, Any]) -> Optional[dict[str, Any]]:
        """
        Evaluate the rule against an event.
        Returns an alert dict if the rule triggers, None otherwise.

        Args:
            event: The security event to evaluate
            context: Additional context (recent events, user history, etc.)

        Returns:
            Alert dict with keys: rule_id, severity, description, evidence, mitre
            or None if the rule does not trigger.
        """
        ...

    def should_suppress(self, last_alert_time: Optional[datetime]) -> bool:
        """Check if this rule should be suppressed based on cooldown."""
        if not last_alert_time:
            return False
        cooldown_end = last_alert_time + timedelta(seconds=self.suppression.cooldown_seconds)
        return datetime.now(timezone.utc) < cooldown_end

    def to_dict(self) -> dict[str, Any]:
        """Serialize rule metadata for API responses."""
        return {
            "rule_id": self.rule_id,
            "name": self.name,
            "description": self.description,
            "version": self.version,
            "category": self.category,
            "severity": self.severity.value,
            "confidence": self.confidence,
            "status": self.status.value,
            "mitre_mappings": [
                {
                    "tactic_id": m.tactic_id,
                    "tactic_name": m.tactic_name,
                    "technique_id": m.technique_id,
                    "technique_name": m.technique_name,
                }
                for m in self.mitre_mappings
            ],
            "suppression": {
                "cooldown_seconds": self.suppression.cooldown_seconds,
                "deduplicate_by": self.suppression.deduplicate_by,
                "max_alerts_per_hour": self.suppression.max_alerts_per_hour,
            },
            "tags": self.tags,
            "author": self.author,
            "created_at": self.created_at,
            "updated_at": self.updated_at,
            "references": self.references,
            "false_positive_guidance": self.false_positive_guidance,
        }


class DetectionRegistry:
    """
    Registry for all detection rules.
    Supports registration, lookup, and lifecycle management.
    """

    def __init__(self):
        self._rules: dict[str, DetectionRule] = {}

    def register(self, rule: DetectionRule):
        """Register a detection rule."""
        self._rules[rule.rule_id] = rule
        logger.info("Registered detection rule: %s (v%s) [%s]", rule.rule_id, rule.version, rule.status.value)

    def unregister(self, rule_id: str):
        """Remove a rule from the registry."""
        self._rules.pop(rule_id, None)

    def get(self, rule_id: str) -> Optional[DetectionRule]:
        """Get a rule by ID."""
        return self._rules.get(rule_id)

    def get_active_rules(self, category: Optional[str] = None) -> list[DetectionRule]:
        """Get all active rules, optionally filtered by category."""
        rules = [r for r in self._rules.values() if r.status == RuleStatus.ACTIVE]
        if category:
            rules = [r for r in rules if r.category == category]
        return rules

    def get_all_rules(self) -> list[DetectionRule]:
        """Get all registered rules."""
        return list(self._rules.values())

    def get_by_category(self, category: str) -> list[DetectionRule]:
        """Get rules by category."""
        return [r for r in self._rules.values() if r.category == category]

    def get_by_mitre_tactic(self, tactic_id: str) -> list[DetectionRule]:
        """Get rules that map to a specific MITRE tactic."""
        return [
            r for r in self._rules.values()
            if any(m.tactic_id == tactic_id for m in r.mitre_mappings)
        ]

    def get_coverage_report(self) -> dict[str, Any]:
        """Generate a MITRE ATT&CK coverage report."""
        coverage: dict[str, dict[str, list[str]]] = {}

        for rule in self._rules.values():
            if rule.status != RuleStatus.ACTIVE:
                continue
            for mapping in rule.mitre_mappings:
                if mapping.tactic_id not in coverage:
                    coverage[mapping.tactic_id] = {"tactic_name": mapping.tactic_name, "techniques": []}
                if mapping.technique_id not in coverage[mapping.tactic_id]["techniques"]:
                    coverage[mapping.tactic_id]["techniques"].append(mapping.technique_id)

        return {
            "tactics_covered": len(coverage),
            "total_techniques": sum(len(v["techniques"]) for v in coverage.values()),
            "coverage": coverage,
        }

    @property
    def count(self) -> int:
        return len(self._rules)


# Global registry instance
DETECTION_REGISTRY = DetectionRegistry()
