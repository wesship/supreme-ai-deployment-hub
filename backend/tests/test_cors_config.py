from backend.cors_config import REQUIRED_PRODUCTION_ORIGINS, build_allowed_origins


def test_required_production_origins_survive_environment_override() -> None:
    allowed = build_allowed_origins("https://railway-preview.example.com")

    assert allowed[:3] == list(REQUIRED_PRODUCTION_ORIGINS)
    assert "https://railway-preview.example.com" in allowed


def test_configured_origins_are_trimmed_normalized_and_deduplicated() -> None:
    allowed = build_allowed_origins(
        " https://d3vonn.io/ , https://extra.example.com/ , https://extra.example.com "
    )

    assert allowed == [
        "https://d3vonn.io",
        "https://www.d3vonn.io",
        "https://app.d3vonn.io",
        "https://extra.example.com",
    ]


def test_empty_configuration_returns_only_required_origins() -> None:
    assert build_allowed_origins(None) == list(REQUIRED_PRODUCTION_ORIGINS)
    assert build_allowed_origins("") == list(REQUIRED_PRODUCTION_ORIGINS)
