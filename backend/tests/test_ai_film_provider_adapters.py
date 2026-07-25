from backend.ai_films.providers import PROVIDER_SPECS, provider_health


def test_provider_registry_covers_required_capabilities():
    capabilities = {spec.capability for spec in PROVIDER_SPECS}
    assert {"image", "video", "voice", "music", "email", "publishing"} <= capabilities


def test_provider_health_never_exposes_secret_values():
    fake_env = {
        "OPENAI_API_KEY": "super-secret-key",
        "RESEND_API_KEY": "resend-secret",
        "AI_FILM_EMAIL_FROM": "studio@d3vonn.io",
    }
    health = provider_health(fake_env)
    serialized = repr(health)
    assert "super-secret-key" not in serialized
    assert "resend-secret" not in serialized
    assert health["capabilities"]["image"] is True
    assert health["capabilities"]["email"] is True
    assert health["capabilities"]["video"] is False


def test_all_provider_specs_declare_server_side_environment_contracts():
    for spec in PROVIDER_SPECS:
        assert spec.provider
        assert spec.capability
        assert spec.required_env
        assert all(not name.startswith("VITE_") for name in spec.required_env)
