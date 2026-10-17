import asyncio

from backend.healthos.adapters.fhir import SyntheticFHIRAdapter
from backend.healthos.adapters.policy import SyntheticPolicyAdapter
from backend.healthos.adapters.workflow import InMemoryWorkflowAdapter
from backend.healthos.contracts import HealthWorkflowEnvelope
from backend.healthos.journey import SyntheticHospitalJourney
from backend.healthos.readiness import DependencyStatus
from backend.healthos.synthetic import SYNTHETIC_FHIR_FIXTURES


def envelope():
    return HealthWorkflowEnvelope(
        tenant_id="hospital-sandbox",
        actor_id="synthetic-clerk",
        purpose_of_use="operations-test",
        requested_action="appointment.lookup",
        source_system="synthetic-fhir",
        authorization_level="sandbox",
        audit_event_id="audit-cert-001",
        synthetic=True,
    )


def ready_statuses():
    async def provider():
        return {
            "fhir": DependencyStatus("fhir", True, True, True, True, "reachable"),
            "policy": DependencyStatus("policy", True, True, True, True, "reachable"),
            "temporal": DependencyStatus("temporal", True, True, True, True, "configured"),
        }
    return provider


def test_full_synthetic_hospital_journey_certifies():
    workflow = InMemoryWorkflowAdapter()
    journey = SyntheticHospitalJourney(
        SyntheticFHIRAdapter(SYNTHETIC_FHIR_FIXTURES),
        SyntheticPolicyAdapter(),
        workflow,
        ready_statuses(),
    )
    result = asyncio.run(journey.run(envelope(), "patient-001"))
    assert result["status"] == "certified"
    assert result["resources"] == {
        "patient": "patient-001",
        "encounter": "enc-001",
        "coverage": "cov-001",
        "appointment": "appt-001",
        "task": "task-001",
    }
    assert [entry["step"] for entry in result["audit"]] == [
        "policy", "patient", "encounter", "coverage", "appointment", "task", "workflow"
    ]
    assert workflow.started[0]["payload"]["synthetic"] is True


def test_required_dependency_outage_blocks_journey():
    async def provider():
        return {
            "fhir": DependencyStatus("fhir", True, True, True, True, "reachable"),
            "policy": DependencyStatus("policy", True, True, False, True, "unreachable"),
            "temporal": DependencyStatus("temporal", True, True, True, True, "configured"),
        }

    workflow = InMemoryWorkflowAdapter()
    journey = SyntheticHospitalJourney(
        SyntheticFHIRAdapter(SYNTHETIC_FHIR_FIXTURES),
        SyntheticPolicyAdapter(),
        workflow,
        provider,
    )
    result = asyncio.run(journey.run(envelope(), "patient-001"))
    assert result["status"] == "blocked"
    assert result["reason"] == "required_dependency_unhealthy"
    assert workflow.started == []
    assert result["audit"][0]["step"] == "readiness"


def test_policy_denial_stops_before_fhir_or_workflow():
    workflow = InMemoryWorkflowAdapter()
    journey = SyntheticHospitalJourney(
        SyntheticFHIRAdapter(SYNTHETIC_FHIR_FIXTURES),
        SyntheticPolicyAdapter(allow_read_only=False),
        workflow,
        ready_statuses(),
    )
    result = asyncio.run(journey.run(envelope(), "patient-001"))
    assert result["status"] == "denied"
    assert workflow.started == []
    assert [entry["step"] for entry in result["audit"]] == ["policy"]
