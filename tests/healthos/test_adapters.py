import asyncio

from backend.healthos.adapters.fhir import SyntheticFHIRAdapter
from backend.healthos.adapters.policy import SyntheticPolicyAdapter
from backend.healthos.adapters.workflow import InMemoryWorkflowAdapter
from backend.healthos.synthetic import SYNTHETIC_FHIR_FIXTURES


def test_synthetic_fhir_patient_lookup():
    adapter = SyntheticFHIRAdapter(SYNTHETIC_FHIR_FIXTURES)
    patient = asyncio.run(adapter.get_resource("Patient", "patient-001"))
    assert patient["resourceType"] == "Patient"
    assert patient["id"] == "patient-001"


def test_synthetic_policy_is_read_only():
    policy = SyntheticPolicyAdapter()
    allowed = asyncio.run(policy.authorize({"requested_action": "appointment.lookup"}))
    denied = asyncio.run(policy.authorize({"requested_action": "appointment.reschedule"}))
    assert allowed["allow"] is True
    assert denied["allow"] is False


def test_in_memory_workflow_records_start():
    workflow = InMemoryWorkflowAdapter()
    workflow_id = asyncio.run(workflow.start("post-care-followup", "wf-001", {"synthetic": True}))
    assert workflow_id == "wf-001"
    assert workflow.started[0]["payload"]["synthetic"] is True
