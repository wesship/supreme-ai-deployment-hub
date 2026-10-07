from backend.healthos.contracts import HealthWorkflowEnvelope
from backend.healthos.settings import HealthOSSettings


def test_healthos_defaults_to_disabled_and_synthetic(monkeypatch):
    for key in (
        "HEALTHOS_ENABLED", "HEALTHOS_ALLOW_REAL_DATA", "HEALTHOS_FHIR_ENABLED",
        "HEALTHOS_POLICY_ENABLED", "HEALTHOS_TEMPORAL_ENABLED", "HEALTHOS_IDENTITY_ENABLED",
    ):
        monkeypatch.delenv(key, raising=False)
    settings = HealthOSSettings.from_env()
    assert settings.enabled is False
    assert settings.synthetic_only is True
    assert settings.production_data_allowed() is False


def test_workflow_envelope_requires_governance_context():
    envelope = HealthWorkflowEnvelope(
        tenant_id="sandbox-tenant",
        actor_id="synthetic-user",
        purpose_of_use="operations-test",
        requested_action="appointment.lookup",
        source_system="synthetic-fhir",
        authorization_level="sandbox",
        audit_event_id="audit-test-001",
    )
    envelope.validate()
    assert envelope.synthetic is True


def test_missing_audit_id_fails_validation():
    envelope = HealthWorkflowEnvelope(
        tenant_id="sandbox-tenant",
        actor_id="synthetic-user",
        purpose_of_use="operations-test",
        requested_action="appointment.lookup",
        source_system="synthetic-fhir",
        authorization_level="sandbox",
        audit_event_id="",
    )
    try:
        envelope.validate()
    except ValueError as exc:
        assert "audit_event_id" in str(exc)
    else:
        raise AssertionError("Expected missing audit context to fail")
