import asyncio

from backend.healthos.adapters.workflow import InMemoryWorkflowAdapter
from backend.healthos.interoperability import (
    InMemoryDeadLetterQueue,
    InMemoryReplayStore,
    SyntheticHL7Ingestor,
    parse_adt,
)


ADT_A01 = (
    "MSH|^~\\&|ADT|HOSPITAL|D3VONN|HEALTHOS|202609291200||ADT^A01|MSG-001|P|2.5\r"
    "PID|1||patient-100||Example^Alex\r"
    "PV1|1|I|||||||||||||||||enc-100"
)


class AllowADT:
    async def authorize(self, input_document):
        return {"allow": input_document.get("requested_action") == "adt.ingest", "source": "test-policy"}


class DenyAll:
    async def authorize(self, input_document):
        return {"allow": False, "source": "test-policy"}


def test_parse_adt_to_fhir():
    result = parse_adt(ADT_A01)
    assert result["message_id"] == "MSG-001"
    assert result["event"] == "A01"
    assert result["patient"]["resourceType"] == "Patient"
    assert result["encounter"]["resourceType"] == "Encounter"
    assert result["encounter"]["subject"]["reference"] == "Patient/patient-100"


def test_ingest_starts_replay_safe_workflow():
    workflow = InMemoryWorkflowAdapter()
    store = InMemoryReplayStore()
    ingestor = SyntheticHL7Ingestor(AllowADT(), workflow, store)
    first = asyncio.run(ingestor.ingest(ADT_A01))
    second = asyncio.run(ingestor.ingest(ADT_A01))
    assert first["status"] == "accepted"
    assert second["status"] == "duplicate"
    assert len(workflow.started) == 1
    assert workflow.started[0]["payload"]["synthetic"] is True


def test_malformed_hl7_goes_to_dead_letter():
    dlq = InMemoryDeadLetterQueue()
    ingestor = SyntheticHL7Ingestor(AllowADT(), InMemoryWorkflowAdapter(), dead_letters=dlq)
    result = asyncio.run(ingestor.ingest("PID|1||patient-100"))
    assert result["status"] == "dead_lettered"
    assert len(dlq.items) == 1
    assert "MSH and PID" in dlq.items[0].reason


def test_policy_denial_stops_workflow():
    workflow = InMemoryWorkflowAdapter()
    ingestor = SyntheticHL7Ingestor(DenyAll(), workflow)
    result = asyncio.run(ingestor.ingest(ADT_A01))
    assert result["status"] == "denied"
    assert workflow.started == []
