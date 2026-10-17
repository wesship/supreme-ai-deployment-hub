"""Synthetic end-to-end orchestration service for HealthOS."""
from typing import Any

from backend.healthos.contracts import HealthWorkflowEnvelope


class HealthSandboxService:
    def __init__(self, fhir, policy, workflow):
        self.fhir = fhir
        self.policy = policy
        self.workflow = workflow

    async def patient_appointment_lookup(
        self,
        envelope: HealthWorkflowEnvelope,
        patient_id: str,
    ) -> dict[str, Any]:
        envelope.validate()
        if not envelope.synthetic:
            raise RuntimeError("Gate 4 sandbox accepts synthetic workflows only")

        decision = await self.policy.authorize(
            {
                "tenant_id": envelope.tenant_id,
                "actor_id": envelope.actor_id,
                "purpose_of_use": envelope.purpose_of_use,
                "requested_action": envelope.requested_action,
                "authorization_level": envelope.authorization_level,
                "synthetic": envelope.synthetic,
            }
        )
        if not decision.get("allow", False):
            return {"status": "denied", "policy": decision}

        patient = await self.fhir.get_resource("Patient", patient_id)
        appointments = await self.fhir.search(
            "Appointment",
            {"patient": f"Patient/{patient_id}"},
        )
        workflow_id = f"healthos-{envelope.audit_event_id}"
        await self.workflow.start(
            "healthos_sandbox_trace",
            workflow_id,
            {
                "synthetic": True,
                "audit_event_id": envelope.audit_event_id,
                "requested_action": envelope.requested_action,
            },
        )
        return {
            "status": "ok",
            "patient": patient,
            "appointments": appointments,
            "workflow_id": workflow_id,
            "audit_event_id": envelope.audit_event_id,
        }
