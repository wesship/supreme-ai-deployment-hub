from backend.opensource_integrations.adapters import route_capability
from backend.opensource_integrations.models import CapabilityRequest
from backend.opensource_integrations.registry import get_provider, list_providers


def test_registry_contains_tier_one_recommendations():
    keys = {provider.key for provider in list_providers()}
    assert {"librechat", "open_generative_ai", "agentic_inbox", "hyperframes"}.issubset(keys)


def test_disabled_high_risk_provider_returns_disabled():
    response = route_capability(
        CapabilityRequest(
            capability="quant_research",
            task="Evaluate a live trading setup.",
        )
    )
    assert response.status == "disabled"
    assert response.provider == "autohedge"


def test_unconfigured_tier_one_provider_dry_runs():
    response = route_capability(
        CapabilityRequest(
            capability="email_triage",
            task="Classify insurance leads.",
        )
    )
    assert response.provider == "agentic_inbox"
    assert response.status in {"dry_run_env_required", "ready_for_live_client"}


def test_provider_lookup():
    provider = get_provider("librechat")
    assert provider is not None
    assert "multi_model_routing" in provider.capabilities
