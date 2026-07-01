"""Identity detection rules — privilege escalation, account changes, insider threats."""

from dataclasses import dataclass, field
from typing import Any, Optional

from ..base import (
    DETECTION_REGISTRY, DetectionRule, MitreMapping,
    RuleSeverity, RuleStatus, SuppressionConfig,
)


@dataclass
class PrivilegeEscalationDetection(DetectionRule):
    """Detects unauthorized privilege escalation."""

    rule_id: str = "IDN-001"
    name: str = "Privilege Escalation"
    description: str = "User role elevated to admin without proper authorization workflow"
    version: str = "1.0.0"
    category: str = "identity"
    severity: RuleSeverity = RuleSeverity.CRITICAL
    confidence: int = 90
    status: RuleStatus = RuleStatus.ACTIVE
    mitre_mappings: list[MitreMapping] = field(default_factory=lambda: [
        MitreMapping("TA0004", "Privilege Escalation", "T1078", "Valid Accounts", "T1078.004", "Cloud Accounts"),
    ])
    tags: list[str] = field(default_factory=lambda: ["identity", "privilege-escalation"])
    false_positive_guidance: str = "Legitimate admin promotions should go through the approval workflow."

    async def evaluate(self, event: dict[str, Any], context: dict[str, Any]) -> Optional[dict[str, Any]]:
        if "role_changed" not in event.get("event_type", ""):
            return None
        metadata = event.get("metadata", {})
        new_role = metadata.get("new_role", "")
        old_role = metadata.get("old_role", "")
        changed_by = metadata.get("changed_by", "")
        actor = event.get("actor", "")

        # Self-promotion is always suspicious
        if changed_by == actor and new_role in ("admin", "superadmin"):
            return {
                "description": f"Self-promotion detected: {actor} changed own role from {old_role} to {new_role}",
                "severity": "critical",
                "evidence": {"old_role": old_role, "new_role": new_role, "self_promoted": True},
            }

        # Any elevation to admin is noteworthy
        if new_role in ("admin", "superadmin") and old_role not in ("admin", "superadmin"):
            return {
                "description": f"Privilege escalation: {actor} elevated from {old_role} to {new_role}",
                "evidence": {"old_role": old_role, "new_role": new_role, "changed_by": changed_by},
            }
        return None


@dataclass
class AccountTakeoverDetection(DetectionRule):
    """Detects account takeover patterns: email change + password change in sequence."""

    rule_id: str = "IDN-002"
    name: str = "Account Takeover Sequence"
    description: str = "Email and password changed in rapid succession, indicating account takeover"
    version: str = "1.0.0"
    category: str = "identity"
    severity: RuleSeverity = RuleSeverity.CRITICAL
    confidence: int = 85
    status: RuleStatus = RuleStatus.ACTIVE
    mitre_mappings: list[MitreMapping] = field(default_factory=lambda: [
        MitreMapping("TA0003", "Persistence", "T1098", "Account Manipulation"),
    ])
    tags: list[str] = field(default_factory=lambda: ["identity", "account-takeover"])
    false_positive_guidance: str = "Users may change both email and password during legitimate account recovery."

    async def evaluate(self, event: dict[str, Any], context: dict[str, Any]) -> Optional[dict[str, Any]]:
        event_type = event.get("event_type", "")
        if "email_changed" not in event_type and "password_changed" not in event_type:
            return None

        actor_events = context.get("actor_events", [])
        recent_changes = [
            e for e in actor_events
            if "email_changed" in e.get("event_type", "") or "password_changed" in e.get("event_type", "")
        ]

        if len(recent_changes) >= 2:
            return {
                "description": f"Account takeover pattern: multiple credential changes for {event.get('actor')}",
                "severity": "critical",
                "evidence": {"changes": len(recent_changes), "types": [e.get("event_type") for e in recent_changes]},
            }
        return None


@dataclass
class AuditLogTamperingDetection(DetectionRule):
    """Detects attempts to clear or modify audit logs."""

    rule_id: str = "IDN-003"
    name: str = "Audit Log Tampering"
    description: str = "Audit logs cleared or modified, indicating cover-up attempt"
    version: str = "1.0.0"
    category: str = "identity"
    severity: RuleSeverity = RuleSeverity.CRITICAL
    confidence: int = 95
    status: RuleStatus = RuleStatus.ACTIVE
    mitre_mappings: list[MitreMapping] = field(default_factory=lambda: [
        MitreMapping("TA0005", "Defense Evasion", "T1070", "Indicator Removal"),
    ])
    tags: list[str] = field(default_factory=lambda: ["identity", "defense-evasion", "audit-tampering"])
    false_positive_guidance: str = "Scheduled log rotation should not trigger this. Only manual deletions are flagged."

    async def evaluate(self, event: dict[str, Any], context: dict[str, Any]) -> Optional[dict[str, Any]]:
        if "audit_log_cleared" not in event.get("event_type", "") and "log_deleted" not in event.get("event_type", ""):
            return None
        return {
            "description": f"Audit log tampering by {event.get('actor')}: logs cleared from {event.get('ip')}",
            "severity": "critical",
            "evidence": event.get("metadata", {}),
        }


# Register all identity rules
DETECTION_REGISTRY.register(PrivilegeEscalationDetection())
DETECTION_REGISTRY.register(AccountTakeoverDetection())
DETECTION_REGISTRY.register(AuditLogTamperingDetection())
