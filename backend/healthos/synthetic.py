"""Synthetic FHIR fixtures for HealthOS integration testing."""
SYNTHETIC_FHIR_FIXTURES = {
    "Patient/patient-001": {
        "resourceType": "Patient",
        "id": "patient-001",
        "identifier": [{"system": "urn:d3vonn:synthetic", "value": "SYN-001"}],
        "name": [{"family": "Example", "given": ["Jordan"]}],
        "active": True,
    },
    "Appointment/appt-001": {
        "resourceType": "Appointment",
        "id": "appt-001",
        "status": "booked",
        "description": "Synthetic outpatient follow-up",
        "participant": [{"actor": {"reference": "Patient/patient-001"}, "status": "accepted"}],
    },
}
