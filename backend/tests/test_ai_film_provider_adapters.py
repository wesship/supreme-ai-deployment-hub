from backend.ai_films.providers import PROVIDER_SPECS, provider_health


def test_provider_registry_covers_required_capabilities():
    capabilities = {spec.capability for spec in PROVIDER_SPECS}
    assert {"image", "video", "voice", "music", "email", "publishing", "commerce_generation", "video_intelligence"} <= capabilities


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
    assert health["capabilities"]["video"] is True


def test_all_provider_specs_declare_server_side_runtime_contracts():
    for spec in PROVIDER_SPECS:
        assert spec.provider
        assert spec.capability
        assert all(not name.startswith("VITE_") for name in spec.required_env)

        if spec.dispatchable:
            assert spec.required_env or spec.required_binary
        else:
            assert spec.lifecycle != "production"
            assert spec.configured({}) is False


def test_ffmpeg_assembly_declares_binary_runtime_requirement():
    spec = next(
        spec
        for spec in PROVIDER_SPECS
        if spec.capability == "assembly" and spec.provider == "ffmpeg"
    )
    assert spec.required_env == ()
    assert spec.required_binary == ("ffmpeg",)


def test_commerce_generation_requires_signed_webhook_runtime():
    incomplete = provider_health({"POLLO_API_KEY": "test-key"})
    assert incomplete["capabilities"]["commerce_generation"] is False

    complete = provider_health(
        {
            "POLLO_API_KEY": "test-key",
            "POLLO_WEBHOOK_URL": "https://api.d3vonn.io/api/ai-films/commerce/providers/pollo/webhook",
            "POLLO_WEBHOOK_SECRET": "base64-secret",
        }
    )
    assert complete["capabilities"]["commerce_generation"] is True
    spec = next(
        spec
        for spec in PROVIDER_SPECS
        if spec.capability == "commerce_generation" and spec.provider == "pollo"
    )
    assert spec.required_env == (
        "POLLO_API_KEY",
        "POLLO_WEBHOOK_URL",
        "POLLO_WEBHOOK_SECRET",
    )
