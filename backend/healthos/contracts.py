"""Cross-system contracts for Hermes HealthOS workflows."""
from dataclasses import dataclass, field
from typing import Any


@dataclass(frozen=True)
class HealthWorkflowEnvelope:
    tenant_id: str
    actor_id: str
    purpose_of_use: str
    requested_action: str
    source_system: str
    authorization_level: str
    audit_event_id: str
    consent_scope: tuple[str, ...] = ()
    human_review_required: bool = False
    synthetic: bool = True
    correlation_id: str = ""
    metadata: dict[str, Any] = field(default_factory=dict)

    def validate(self) -> None:
        required = {
            "tenant_id": self.tenant_id,
            "actor_id": self.actor_id,
            "purpose_of_use": self.purpose_of_use,
            "requested_action": self.requested_action,
            "source_system": self.source_system,
            "authorization_level": self.authorization_level,
            "audit_event_id": self.audit_event_id,
        }
        missing = [name for name, value in required.items() if not value.strip()]
        if missing:
            raise ValueError(f"Missing HealthOS workflow context: {', '.join(missing)}")
