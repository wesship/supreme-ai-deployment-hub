"""Feature-gated HealthOS settings. All external integrations default off."""
from dataclasses import dataclass
import os


def _enabled(name: str) -> bool:
    return os.getenv(name, "").strip().lower() in {"1", "true", "yes", "on"}


@dataclass(frozen=True)
class HealthOSSettings:
    enabled: bool
    synthetic_only: bool
    fhir_enabled: bool
    policy_enabled: bool
    temporal_enabled: bool
    identity_enabled: bool
    ehr_enabled: bool
    integration_engine_enabled: bool
    fhir_base_url: str
    temporal_target: str
    policy_url: str
    identity_issuer: str
    ehr_base_url: str
    integration_engine_url: str

    @classmethod
    def from_env(cls) -> "HealthOSSettings":
        return cls(
            enabled=_enabled("HEALTHOS_ENABLED"),
            synthetic_only=not _enabled("HEALTHOS_ALLOW_REAL_DATA"),
            fhir_enabled=_enabled("HEALTHOS_FHIR_ENABLED"),
            policy_enabled=_enabled("HEALTHOS_POLICY_ENABLED"),
            temporal_enabled=_enabled("HEALTHOS_TEMPORAL_ENABLED"),
            identity_enabled=_enabled("HEALTHOS_IDENTITY_ENABLED"),
            ehr_enabled=_enabled("HEALTHOS_EHR_ENABLED"),
            integration_engine_enabled=_enabled("HEALTHOS_INTEGRATION_ENGINE_ENABLED"),
            fhir_base_url=os.getenv("HEALTHOS_FHIR_BASE_URL", "").strip(),
            temporal_target=os.getenv("HEALTHOS_TEMPORAL_TARGET", "").strip(),
            policy_url=os.getenv("HEALTHOS_POLICY_URL", "").strip(),
            identity_issuer=os.getenv("HEALTHOS_IDENTITY_ISSUER", "").strip(),
            ehr_base_url=os.getenv("HEALTHOS_EHR_BASE_URL", "").strip(),
            integration_engine_url=os.getenv("HEALTHOS_INTEGRATION_ENGINE_URL", "").strip(),
        )

    def production_data_allowed(self) -> bool:
        return self.enabled and not self.synthetic_only
