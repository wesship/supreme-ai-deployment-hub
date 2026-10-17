"""Synthetic HL7 v2 -> FHIR normalization and replay-safe ingestion for HealthOS."""
from dataclasses import dataclass, field
from hashlib import sha256
from typing import Any


class HL7ParseError(ValueError):
    pass


@dataclass
class DeadLetter:
    message_id: str
    reason: str
    raw: str


@dataclass
class InMemoryReplayStore:
    seen: set[str] = field(default_factory=set)

    def first_seen(self, message_id: str) -> bool:
        if message_id in self.seen:
            return False
        self.seen.add(message_id)
        return True


@dataclass
class InMemoryDeadLetterQueue:
    items: list[DeadLetter] = field(default_factory=list)

    def push(self, item: DeadLetter) -> None:
        self.items.append(item)


def _segments(raw: str) -> dict[str, list[str]]:
    parsed: dict[str, list[str]] = {}
    for line in raw.replace("\n", "\r").split("\r"):
        line = line.strip()
        if not line:
            continue
        fields = line.split("|")
        parsed[fields[0]] = fields
    return parsed


def parse_adt(raw: str) -> dict[str, Any]:
    segments = _segments(raw)
    msh = segments.get("MSH")
    pid = segments.get("PID")
    pv1 = segments.get("PV1")
    if not msh or not pid:
        raise HL7ParseError("MSH and PID segments are required")

    message_type = msh[8] if len(msh) > 8 else ""
    message_id = msh[9] if len(msh) > 9 else ""
    if not message_type.startswith("ADT^"):
        raise HL7ParseError("Only synthetic ADT messages are accepted")
    if not message_id:
        raise HL7ParseError("MSH-10 message control ID is required")

    patient_id = pid[3] if len(pid) > 3 else ""
    patient_name = pid[5] if len(pid) > 5 else ""
    if not patient_id:
        raise HL7ParseError("PID-3 patient identifier is required")

    event = message_type.split("^", 1)[1]
    visit_id = pv1[19] if pv1 and len(pv1) > 19 and pv1[19] else f"visit-{message_id}"
    patient_parts = patient_name.split("^") if patient_name else []
    family = patient_parts[0] if patient_parts else "Synthetic"
    given = patient_parts[1] if len(patient_parts) > 1 else "Patient"

    return {
        "message_id": message_id,
        "event": event,
        "patient": {
            "resourceType": "Patient",
            "id": patient_id,
            "identifier": [{"system": "urn:d3vonn:synthetic-hl7", "value": patient_id}],
            "name": [{"family": family, "given": [given]}],
            "active": True,
        },
        "encounter": {
            "resourceType": "Encounter",
            "id": visit_id,
            "status": "in-progress" if event in {"A01", "A02", "A04"} else "finished",
            "subject": {"reference": f"Patient/{patient_id}"},
            "identifier": [{"system": "urn:d3vonn:synthetic-visit", "value": visit_id}],
        },
    }


class SyntheticHL7Ingestor:
    def __init__(self, policy, workflow, replay_store=None, dead_letters=None):
        self.policy = policy
        self.workflow = workflow
        self.replay_store = replay_store or InMemoryReplayStore()
        self.dead_letters = dead_letters or InMemoryDeadLetterQueue()

    async def ingest(self, raw: str) -> dict[str, Any]:
        fallback_id = sha256(raw.encode("utf-8")).hexdigest()[:16]
        try:
            normalized = parse_adt(raw)
        except HL7ParseError as exc:
            self.dead_letters.push(DeadLetter(fallback_id, str(exc), raw))
            return {"status": "dead_lettered", "message_id": fallback_id, "reason": str(exc)}

        message_id = normalized["message_id"]
        if not self.replay_store.first_seen(message_id):
            return {"status": "duplicate", "message_id": message_id}

        decision = await self.policy.authorize({
            "requested_action": "adt.ingest",
            "message_id": message_id,
            "synthetic": True,
        })
        if not decision.get("allow", False):
            return {"status": "denied", "message_id": message_id}

        workflow_id = f"adt-{message_id}"
        await self.workflow.start(
            "healthos_adt_ingest",
            workflow_id,
            {
                "synthetic": True,
                "message_id": message_id,
                "event": normalized["event"],
                "patient": normalized["patient"],
                "encounter": normalized["encounter"],
            },
        )
        return {
            "status": "accepted",
            "message_id": message_id,
            "event": normalized["event"],
            "fhir": {
                "patient": normalized["patient"],
                "encounter": normalized["encounter"],
            },
            "workflow_id": workflow_id,
        }
