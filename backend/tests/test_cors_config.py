from backend.cors_config import PRODUCTION_ORIGINS, build_allowed_origins


def test_official_production_origins_are_always_present() -> None:
    origins = build_allowed_origins("https://internal.example, http://localhost:5173")

    for origin in PRODUCTION_ORIGINS:
        assert origin in origins

    assert {"https://internal.example", "http://localhost:5173"}.issubset(set(origins))


def test_configured_origins_extend_instead_of_replace() -> None:
    origins = build_allowed_origins("https://d3vonn.io,https://preview.example")

    assert origins == [
        "https://d3vonn.io",
        "https://www.d3vonn.io",
        "https://app.d3vonn.io",
        "https://preview.example",
    ]


def test_empty_configuration_keeps_only_official_origins() -> None:
    assert build_allowed_origins(None) == list(PRODUCTION_ORIGINS)
    assert build_allowed_origins(" , ") == list(PRODUCTION_ORIGINS)
