import re

from backend.cors_config import (
    DEFAULT_PREVIEW_ORIGIN_REGEX,
    PRODUCTION_ORIGINS,
    build_allowed_origin_regex,
    build_allowed_origins,
)


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


def test_preview_origin_regex_allows_canonical_vercel_preview() -> None:
    regex = build_allowed_origin_regex(None)
    assert regex == DEFAULT_PREVIEW_ORIGIN_REGEX
    assert re.fullmatch(regex, "https://supreme-ai-deployment-hub-git-main-acme.vercel.app")
    assert not re.fullmatch(regex, "https://evil.example.com")


def test_configured_preview_origin_regex_overrides_default() -> None:
    assert build_allowed_origin_regex(r"https://preview\.example") == r"https://preview\.example"
