import asyncio

from backend.healthos.adapters.fhir import SyntheticFHIRAdapter
from backend.healthos.adapters.policy import SyntheticPolicyAdapter
from backend.healthos.adapters.workflow import InMemoryWorkflowAdapter
from backend.healthos.contracts import HealthWorkflowEnvelope
from backend.healthos.service import HealthSandboxService
from backend.healthos.synthetic import SYNTHETIC_FHIR_FIXTURES


def test_synthetic_end_to_end_lookup():
    workflow = InMemoryWorkflowAdapter()
    service = HealthSandboxService(
        SyntheticFHIRAdapter(SYNTHETIC_FHIR_FIXTURES),
        SyntheticPolicyAdapter(),
        workflow,
    )
    envelope = HealthWorkflowEnvelope(
        tenant_id="sandbox-tenant",
        actor_id="synthetic-user",
        purpose_of_use="operations-test",
        requested_action="appointment.lookup",
        source_system="synthetic-fhir",
        authorization_level="sandbox",
        audit_event_id="audit-e2e-001",
        synthetic=True,
    )
    result = asyncio.run(service.patient_appointment_lookup(envelope, "patient-001"))
    assert result["status"] == "ok"
    assert result["patient"]["id"] == "patient-001"
    assert result["appointments"]["resourceType"] == "Bundle"
    assert result["workflow_id"] == "healthos-audit-e2e-001"
    assert workflow.started[0]["payload"]["synthetic"] is True


def test_non_synthetic_flow_is_rejected():
    service = HealthSandboxService(
        SyntheticFHIRAdapter(SYNTHETIC_FHIR_FIXTURES),
        SyntheticPolicyAdapter(),
        InMemoryWorkflowAdapter(),
    )
    envelope = HealthWorkflowEnvelope(
        tenant_id="sandbox-tenant",
        actor_id="synthetic-user",
        purpose_of_use="operations-test",
        requested_action="appointment.lookup",
        source_system="synthetic-fhir",
        authorization_level="sandbox",
        audit_event_id="audit-e2e-002",
        synthetic=False,
    )
    try:
        asyncio.run(service.patient_appointment_lookup(envelope, "patient-001"))
    except RuntimeError as exc:
        assert "synthetic workflows only" in str(exc)
    else:
        raise AssertionError("Expected non-synthetic HealthOS workflow to be rejected")
