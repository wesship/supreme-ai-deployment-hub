from __future__ import annotations

from backend.genesis.repository import GenesisRepository


def test_opaque_supabase_secret_key_uses_apikey_only(monkeypatch) -> None:
    monkeypatch.setenv("SUPABASE_URL", "https://example.supabase.co")
    monkeypatch.setenv("SUPABASE_SERVICE_ROLE_KEY", "sb_secret_example")

    headers = GenesisRepository()._headers

    assert headers["apikey"] == "sb_secret_example"
    assert "Authorization" not in headers
    assert headers["Content-Type"] == "application/json"


def test_legacy_service_role_jwt_keeps_bearer_header(monkeypatch) -> None:
    monkeypatch.setenv("SUPABASE_URL", "https://example.supabase.co")
    monkeypatch.setenv("SUPABASE_SERVICE_ROLE_KEY", "eyJlegacy-service-role")

    headers = GenesisRepository()._headers

    assert headers["apikey"] == "eyJlegacy-service-role"
    assert headers["Authorization"] == "Bearer eyJlegacy-service-role"
