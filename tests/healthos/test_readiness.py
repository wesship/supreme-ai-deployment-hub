import asyncio
from dataclasses import replace

from backend.healthos.readiness import check_healthos_dependencies, sandbox_ready
from backend.healthos.settings import HealthOSSettings


BASE = HealthOSSettings(
    enabled=True,
    synthetic_only=True,
    fhir_enabled=True,
    policy_enabled=True,
    temporal_enabled=True,
    identity_enabled=False,
    ehr_enabled=False,
    integration_engine_enabled=False,
    fhir_base_url="http://fhir.test",
    temporal_target="temporal.test:7233",
    policy_url="http://opa.test",
    identity_issuer="",
    ehr_base_url="",
    integration_engine_url="",
)


def test_required_dependencies_can_be_ready():
    async def probe(url: str) -> bool:
        return url in {"http://fhir.test", "http://opa.test"}

    statuses = asyncio.run(check_healthos_dependencies(BASE, probe))
    assert sandbox_ready(statuses) is True


def test_unreachable_policy_fails_closed():
    async def probe(url: str) -> bool:
        return url == "http://fhir.test"

    statuses = asyncio.run(check_healthos_dependencies(BASE, probe))
    assert statuses["policy"].healthy is False
    assert sandbox_ready(statuses) is False


def test_optional_ehr_does_not_block_core_sandbox():
    async def probe(url: str) -> bool:
        return True

    settings = replace(BASE, ehr_enabled=True, ehr_base_url="http://openmrs.test")
    statuses = asyncio.run(check_healthos_dependencies(settings, probe))
    assert statuses["ehr"].healthy is True
    assert sandbox_ready(statuses) is True
