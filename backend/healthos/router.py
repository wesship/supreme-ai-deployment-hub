"""Feature-gated synthetic HealthOS API routes."""
from fastapi import APIRouter, HTTPException

from backend.healthos.adapters.fhir import SyntheticFHIRAdapter
from backend.healthos.adapters.policy import SyntheticPolicyAdapter
from backend.healthos.adapters.workflow import InMemoryWorkflowAdapter
from backend.healthos.contracts import HealthWorkflowEnvelope
from backend.healthos.service import HealthSandboxService
from backend.healthos.settings import HealthOSSettings
from backend.healthos.readiness import check_healthos_dependencies, sandbox_ready
from backend.healthos.journey import SyntheticHospitalJourney
from backend.healthos.interoperability import SyntheticHL7Ingestor
from backend.healthos.synthetic_hl7 import ADT_A01_ADMISSION, ADT_A03_DISCHARGE
from backend.healthos.synthetic import SYNTHETIC_FHIR_FIXTURES

router = APIRouter(prefix="/api/health", tags=["healthos"])


def _settings() -> HealthOSSettings:
    settings = HealthOSSettings.from_env()
    if not settings.enabled:
        raise HTTPException(status_code=404, detail="HealthOS is disabled")
    if not settings.synthetic_only:
        raise HTTPException(status_code=503, detail="Real-data mode is not certified")
    return settings


@router.get("/status")
async def healthos_status():
    settings = _settings()
    return {
        "status": "enabled",
        "mode": "synthetic",
        "fhir_enabled": settings.fhir_enabled,
        "policy_enabled": settings.policy_enabled,
        "temporal_enabled": settings.temporal_enabled,
        "real_data_allowed": settings.production_data_allowed(),
    }


@router.get("/readiness")
async def healthos_readiness():
    settings = _settings()
    statuses = await check_healthos_dependencies(settings)
    return {
        "ready": sandbox_ready(statuses),
        "mode": "synthetic",
        "dependencies": {
            name: {
                "enabled": item.enabled,
                "configured": item.configured,
                "healthy": item.healthy,
                "required": item.required,
                "detail": item.detail,
            }
            for name, item in statuses.items()
        },
    }


@router.get("/sandbox/patient/{patient_id}/appointments")
async def synthetic_patient_appointments(patient_id: str):
    _settings()
    envelope = HealthWorkflowEnvelope(
        tenant_id="healthos-sandbox",
        actor_id="synthetic-api-user",
        purpose_of_use="operations-test",
        requested_action="appointment.lookup",
        source_system="synthetic-fhir",
        authorization_level="sandbox",
        audit_event_id=f"lookup-{patient_id}",
        synthetic=True,
    )
    service = HealthSandboxService(
        SyntheticFHIRAdapter(SYNTHETIC_FHIR_FIXTURES),
        SyntheticPolicyAdapter(),
        InMemoryWorkflowAdapter(),
    )
    try:
        return await service.patient_appointment_lookup(envelope, patient_id)
    except KeyError:
        raise HTTPException(status_code=404, detail="Synthetic patient not found")


@router.get("/sandbox/certify/patient/{patient_id}")
async def certify_synthetic_hospital_journey(patient_id: str):
    settings = _settings()

    async def readiness_provider():
        return await check_healthos_dependencies(settings)

    envelope = HealthWorkflowEnvelope(
        tenant_id="healthos-sandbox",
        actor_id="synthetic-certifier",
        purpose_of_use="operations-test",
        requested_action="appointment.lookup",
        source_system="synthetic-fhir",
        authorization_level="sandbox",
        audit_event_id=f"cert-{patient_id}",
        synthetic=True,
    )
    journey = SyntheticHospitalJourney(
        SyntheticFHIRAdapter(SYNTHETIC_FHIR_FIXTURES),
        SyntheticPolicyAdapter(),
        InMemoryWorkflowAdapter(),
        readiness_provider,
    )
    try:
        return await journey.run(envelope, patient_id)
    except KeyError:
        raise HTTPException(status_code=404, detail="Synthetic hospital resource not found")


@router.post("/sandbox/hl7/adt/{event}")
async def ingest_synthetic_adt(event: str):
    _settings()
    messages = {
        "A01": ADT_A01_ADMISSION,
        "A03": ADT_A03_DISCHARGE,
    }
    raw = messages.get(event.upper())
    if raw is None:
        raise HTTPException(status_code=400, detail="Supported synthetic ADT events: A01, A03")
    ingestor = SyntheticHL7Ingestor(
        SyntheticPolicyAdapter(),
        InMemoryWorkflowAdapter(),
    )
    return await ingestor.ingest(raw)
