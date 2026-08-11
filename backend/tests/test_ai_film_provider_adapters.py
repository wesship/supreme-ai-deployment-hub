import json

import pytest

from backend.ai_films.providers import PROVIDER_SPECS, provider_health, provider_specs


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
        assert spec.required_env or spec.required_binary
        assert all(not name.startswith("VITE_") for name in spec.required_env)


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


def test_kling_and_invideo_are_first_class_image_video_providers():
    pairs = {(spec.capability, spec.provider) for spec in PROVIDER_SPECS}
    assert ("image", "kling") in pairs
    assert ("video", "kling") in pairs
    assert ("video", "invideo") in pairs


def test_custom_provider_registry_adds_server_side_provider_without_code_change():
    env = {
        "CUSTOM_VIDEO_TOKEN": "configured",
        "CUSTOM_VIDEO_MODEL": "studio-v1",
        "AI_FILM_CUSTOM_PROVIDERS_JSON": json.dumps(
            [
                {
                    "capability": "video",
                    "provider": "studio_x",
                    "required_env": ["CUSTOM_VIDEO_TOKEN"],
                    "model_env": "CUSTOM_VIDEO_MODEL",
                }
            ]
        ),
    }
    custom = next(spec for spec in provider_specs(env) if spec.provider == "studio_x")
    assert custom.source == "custom"
    assert custom.configured(env) is True
    health = provider_health(env)
    row = next(item for item in health["providers"] if item["provider"] == "studio_x")
    assert row["status"] == "configured"
    assert "CUSTOM_VIDEO_TOKEN" in row["required_env"]
    assert "studio-v1" not in repr(row)


def test_custom_provider_registry_rejects_client_exposed_credentials():
    env = {
        "AI_FILM_CUSTOM_PROVIDERS_JSON": json.dumps(
            [
                {
                    "capability": "video",
                    "provider": "unsafe",
                    "required_env": ["VITE_UNSAFE_API_KEY"],
                }
            ]
        )
    }
    with pytest.raises(ValueError, match="VITE"):
        provider_specs(env)
