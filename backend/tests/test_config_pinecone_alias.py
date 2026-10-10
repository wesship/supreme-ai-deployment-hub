"""Configuration tests for Pinecone deployment variable compatibility."""

from backend.app.config import Settings


def _clear_pinecone_env(monkeypatch) -> None:
    for name in (
        "PineconeApiKey",
        "PINECONE_API_KEY",
        "pinecone_api_key",
        "PineconeHost",
        "PINECONE_HOST",
        "pinecone_host",
        "PineconeIndex",
        "PINECONE_INDEX",
        "PINECONE_INDEX_NAME",
        "pinecone_index_name",
    ):
        monkeypatch.delenv(name, raising=False)


def test_camel_case_pinecone_variables_are_loaded(monkeypatch):
    _clear_pinecone_env(monkeypatch)
    monkeypatch.setenv("PineconeApiKey", "pinecone-key")
    monkeypatch.setenv("PineconeHost", "index-host.example")
    monkeypatch.setenv("PineconeIndex", "live-index")

    settings = Settings(_env_file=None)

    assert settings.pinecone_api_key == "pinecone-key"
    assert settings.pinecone_host == "index-host.example"
    assert settings.pinecone_index_name == "live-index"


def test_established_pinecone_index_variable_is_supported(monkeypatch):
    _clear_pinecone_env(monkeypatch)
    monkeypatch.setenv("PINECONE_API_KEY", "pinecone-key")
    monkeypatch.setenv("PINECONE_INDEX", "devonn-rag")

    settings = Settings(_env_file=None)

    assert settings.pinecone_api_key == "pinecone-key"
    assert settings.pinecone_host == ""
    assert settings.pinecone_index_name == "devonn-rag"


def test_established_index_name_wins_over_static_proxy_name(monkeypatch):
    _clear_pinecone_env(monkeypatch)
    monkeypatch.setenv("PINECONE_INDEX", "live-index")
    monkeypatch.setenv("PINECONE_INDEX_NAME", "document-store")

    settings = Settings(_env_file=None)

    assert settings.pinecone_index_name == "live-index"


def test_current_proxy_pinecone_names_remain_supported(monkeypatch):
    _clear_pinecone_env(monkeypatch)
    monkeypatch.setenv("PINECONE_API_KEY", "pinecone-key")
    monkeypatch.setenv("PINECONE_HOST", "index-host.example")
    monkeypatch.setenv("PINECONE_INDEX_NAME", "document-store")

    settings = Settings(_env_file=None)

    assert settings.pinecone_api_key == "pinecone-key"
    assert settings.pinecone_host == "index-host.example"
    assert settings.pinecone_index_name == "document-store"
