"""Synthetic hospital journey certification for D3VONN HealthOS."""
from dataclasses import dataclass, field
from typing import Any

from backend.healthos.contracts import HealthWorkflowEnvelope
from backend.healthos.readiness import sandbox_ready


@dataclass
class AuditRecord:
    step: str
    audit_event_id: str
    status: str
    metadata: dict[str, Any] = field(default_factory=dict)


class SyntheticHospitalJourney:
    def __init__(self, fhir, policy, workflow, readiness_provider):
        self.fhir = fhir
        self.policy = policy
        self.workflow = workflow
        self.readiness_provider = readiness_provider
        self.audit: list[AuditRecord] = []

    async def run(self, envelope: HealthWorkflowEnvelope, patient_id: str) -> dict[str, Any]:
        envelope.validate()
        if not envelope.synthetic:
            raise RuntimeError("Certification journey is synthetic-only")

        statuses = await self.readiness_provider()
        if not sandbox_ready(statuses):
            self.audit.append(AuditRecord(
                step="readiness",
                audit_event_id=envelope.audit_event_id,
                status="blocked",
                metadata={"reason": "required_dependency_unhealthy"},
            ))
            return {
                "status": "blocked",
                "reason": "required_dependency_unhealthy",
                "audit": [record.__dict__ for record in self.audit],
            }

        decision = await self.policy.authorize({
            "tenant_id": envelope.tenant_id,
            "actor_id": envelope.actor_id,
            "purpose_of_use": envelope.purpose_of_use,
            "requested_action": envelope.requested_action,
            "authorization_level": envelope.authorization_level,
            "synthetic": True,
        })
        self.audit.append(AuditRecord(
            step="policy",
            audit_event_id=envelope.audit_event_id,
            status="allowed" if decision.get("allow") else "denied",
            metadata={"source": decision.get("source", "unknown")},
        ))
        if not decision.get("allow", False):
            return {
                "status": "denied",
                "audit": [record.__dict__ for record in self.audit],
            }

        patient = await self.fhir.get_resource("Patient", patient_id)
        encounter = await self.fhir.get_resource("Encounter", "enc-001")
        coverage = await self.fhir.get_resource("Coverage", "cov-001")
        appointment = await self.fhir.get_resource("Appointment", "appt-001")
        task = await self.fhir.get_resource("Task", "task-001")

        for step, resource in (
            ("patient", patient),
            ("encounter", encounter),
            ("coverage", coverage),
            ("appointment", appointment),
            ("task", task),
        ):
            self.audit.append(AuditRecord(
                step=step,
                audit_event_id=envelope.audit_event_id,
                status="loaded",
                metadata={"resourceType": resource["resourceType"], "id": resource["id"]},
            ))

        workflow_id = f"hospital-journey-{envelope.audit_event_id}"
        await self.workflow.start(
            "healthos_hospital_journey",
            workflow_id,
            {
                "synthetic": True,
                "patient_id": patient_id,
                "audit_event_id": envelope.audit_event_id,
                "steps": ["admission", "coverage", "appointment", "followup"],
            },
        )
        self.audit.append(AuditRecord(
            step="workflow",
            audit_event_id=envelope.audit_event_id,
            status="started",
            metadata={"workflow_id": workflow_id},
        ))

        return {
            "status": "certified",
            "workflow_id": workflow_id,
            "resources": {
                "patient": patient["id"],
                "encounter": encounter["id"],
                "coverage": coverage["id"],
                "appointment": appointment["id"],
                "task": task["id"],
            },
            "audit": [record.__dict__ for record in self.audit],
        }
