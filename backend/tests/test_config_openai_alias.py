"""Configuration tests for the Railway OpenAI key variable alias."""

from backend.app.config import Settings


def _clear_openai_env(monkeypatch) -> None:
    monkeypatch.delenv("OpenAiKey", raising=False)
    monkeypatch.delenv("OPENAI_API_KEY", raising=False)
    monkeypatch.delenv("openai_api_key", raising=False)


def test_railway_open_ai_key_alias_is_loaded(monkeypatch):
    _clear_openai_env(monkeypatch)
    monkeypatch.setenv("OpenAiKey", "key-from-railway-alias")

    settings = Settings(_env_file=None)

    assert settings.openai_api_key == "key-from-railway-alias"


def test_railway_alias_is_preferred_over_legacy_variable(monkeypatch):
    _clear_openai_env(monkeypatch)
    monkeypatch.setenv("OpenAiKey", "preferred-railway-key")
    monkeypatch.setenv("OPENAI_API_KEY", "legacy-key")

    settings = Settings(_env_file=None)

    assert settings.openai_api_key == "preferred-railway-key"


def test_standard_openai_variable_remains_supported(monkeypatch):
    _clear_openai_env(monkeypatch)
    monkeypatch.setenv("OPENAI_API_KEY", "standard-key")

    settings = Settings(_env_file=None)

    assert settings.openai_api_key == "standard-key"


def test_direct_field_construction_remains_supported(monkeypatch):
    _clear_openai_env(monkeypatch)

    settings = Settings(openai_api_key="direct-key", _env_file=None)

    assert settings.openai_api_key == "direct-key"
