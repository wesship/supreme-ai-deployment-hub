"""Synthetic FHIR fixtures for HealthOS integration testing."""
SYNTHETIC_FHIR_FIXTURES = {
    "Patient/patient-001": {
        "resourceType": "Patient",
        "id": "patient-001",
        "identifier": [{"system": "urn:d3vonn:synthetic", "value": "SYN-001"}],
        "name": [{"family": "Example", "given": ["Jordan"]}],
        "active": True,
    },
    "Encounter/enc-001": {
        "resourceType": "Encounter",
        "id": "enc-001",
        "status": "finished",
        "class": {"code": "AMB"},
        "subject": {"reference": "Patient/patient-001"},
    },
    "Coverage/cov-001": {
        "resourceType": "Coverage",
        "id": "cov-001",
        "status": "active",
        "beneficiary": {"reference": "Patient/patient-001"},
        "payor": [{"display": "Synthetic Health Plan"}],
    },
    "Appointment/appt-001": {
        "resourceType": "Appointment",
        "id": "appt-001",
        "status": "booked",
        "description": "Synthetic outpatient follow-up",
        "participant": [{"actor": {"reference": "Patient/patient-001"}, "status": "accepted"}],
    },
    "Task/task-001": {
        "resourceType": "Task",
        "id": "task-001",
        "status": "requested",
        "intent": "order",
        "description": "Synthetic post-care follow-up",
        "for": {"reference": "Patient/patient-001"},
    },
}
