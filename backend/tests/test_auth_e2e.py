"""
backend/tests/test_auth_e2e.py — E2E-style auth integration tests

These tests exercise the full auth middleware stack against a real FastAPI
test client. All external calls (Supabase) are mocked. No real API keys
or tokens are used — only fake values generated for test purposes.

Run with:
    pytest backend/tests/test_auth_e2e.py -v
"""
from __future__ import annotations

import sys
import os
import pytest
from unittest.mock import AsyncMock, MagicMock, patch
from fastapi import FastAPI
from fastapi.testclient import TestClient

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

from backend.app.config import Settings, get_settings
from backend.app.middleware.auth import get_current_user_id
from backend.app.routers.proxy_vault import router as vault_router

# ── Fake constants (never real credentials) ───────────────────────────────────
FAKE_USER_ID = "00000000-0000-0000-0000-000000000001"
FAKE_BEARER = "Bearer eyJhbGciOiJIUzI1NiJ9.fake.token"
FAKE_SUPABASE_URL = "https://fake-project.supabase.co"
FAKE_SERVICE_KEY = "fake-service-role-key"


def _test_settings_auth_on() -> Settings:
    return Settings(
        openai_api_key="sk-fake-openai",
        supabase_url=FAKE_SUPABASE_URL,
        supabase_service_role_key=FAKE_SERVICE_KEY,
        require_auth=True,
        app_env="test",
    )


def _test_settings_auth_off() -> Settings:
    return Settings(
        openai_api_key="sk-fake-openai",
        supabase_url=FAKE_SUPABASE_URL,
        supabase_service_role_key=FAKE_SERVICE_KEY,
        require_auth=False,
        app_env="test",
    )


# ── Test app ──────────────────────────────────────────────────────────────────
test_app = FastAPI()
test_app.include_router(vault_router, prefix="/api")


@pytest.fixture
def client_auth_on():
    """Client with auth enforcement enabled; Supabase calls are mocked."""
    get_settings.cache_clear()
    test_app.dependency_overrides.clear()
    test_app.dependency_overrides[get_settings] = _test_settings_auth_on
    yield TestClient(test_app, raise_server_exceptions=False)
    test_app.dependency_overrides.clear()
    get_settings.cache_clear()


@pytest.fixture
def client_auth_off():
    """Client with auth disabled (dev mode)."""
    get_settings.cache_clear()
    test_app.dependency_overrides.clear()
    test_app.dependency_overrides[get_settings] = _test_settings_auth_off
    # Also patch the module-level call inside the middleware itself
    with patch("backend.app.middleware.auth.get_settings", return_value=_test_settings_auth_off()):
        yield TestClient(test_app, raise_server_exceptions=False)
    test_app.dependency_overrides.clear()
    get_settings.cache_clear()


# ── Auth-off (dev mode) tests ─────────────────────────────────────────────────
class TestAuthDisabled:
    def test_proxy_config_accessible_without_token(self, client_auth_off):
        """When require_auth=False, any request reaches the endpoint."""
        resp = client_auth_off.get("/api/proxy/config")
        assert resp.status_code == 200

    def test_vault_keys_accessible_without_token(self, client_auth_off):
        resp = client_auth_off.get("/api/proxy/vault/keys")
        assert resp.status_code == 200

    def test_dev_mode_user_id_is_placeholder(self, client_auth_off):
        """Dev mode returns 'dev-user' as the placeholder user ID."""
        # The endpoint itself doesn't expose user_id, but we can verify
        # the config endpoint returns 200 (meaning auth passed with dev-user).
        resp = client_auth_off.get("/api/proxy/config")
        assert resp.status_code == 200
        data = resp.json()
        assert data["status"] == "active"


# ── Auth-on (production mode) tests ───────────────────────────────────────────
class TestAuthEnabled:
    def test_missing_token_returns_401(self, client_auth_on):
        """No Authorization header → 401."""
        resp = client_auth_on.get("/api/proxy/config")
        assert resp.status_code == 401

    def test_invalid_token_returns_401(self, client_auth_on):
        """Supabase rejects the token → 401."""
        mock_resp = MagicMock()
        mock_resp.status_code = 401

        with patch("backend.app.middleware.auth.httpx.AsyncClient") as mock_cls:
            mock_client = AsyncMock()
            mock_cls.return_value.__aenter__.return_value = mock_client
            mock_client.get = AsyncMock(return_value=mock_resp)

            resp = client_auth_on.get(
                "/api/proxy/config",
                headers={"Authorization": FAKE_BEARER},
            )
        assert resp.status_code == 401

    def test_valid_token_returns_200(self, client_auth_on):
        """Supabase accepts the token → endpoint returns 200."""
        mock_resp = MagicMock()
        mock_resp.status_code = 200
        mock_resp.json.return_value = {"id": FAKE_USER_ID, "email": "test@d3vonn.io"}

        with patch("backend.app.middleware.auth.httpx.AsyncClient") as mock_cls:
            mock_client = AsyncMock()
            mock_cls.return_value.__aenter__.return_value = mock_client
            mock_client.get = AsyncMock(return_value=mock_resp)

            resp = client_auth_on.get(
                "/api/proxy/config",
                headers={"Authorization": FAKE_BEARER},
            )
        assert resp.status_code == 200

    def test_supabase_unreachable_returns_503(self, client_auth_on):
        """Network error to Supabase → 503 (not 500)."""
        import httpx as _httpx

        with patch("backend.app.middleware.auth.httpx.AsyncClient") as mock_cls:
            mock_client = AsyncMock()
            mock_cls.return_value.__aenter__.return_value = mock_client
            mock_client.get = AsyncMock(
                side_effect=_httpx.RequestError("connection refused")
            )

            resp = client_auth_on.get(
                "/api/proxy/config",
                headers={"Authorization": FAKE_BEARER},
            )
        assert resp.status_code == 503

    def test_supabase_returns_user_without_id_gives_401(self, client_auth_on):
        """Supabase 200 but missing 'id' field → 401."""
        mock_resp = MagicMock()
        mock_resp.status_code = 200
        mock_resp.json.return_value = {"email": "test@d3vonn.io"}  # no 'id'

        with patch("backend.app.middleware.auth.httpx.AsyncClient") as mock_cls:
            mock_client = AsyncMock()
            mock_cls.return_value.__aenter__.return_value = mock_client
            mock_client.get = AsyncMock(return_value=mock_resp)

            resp = client_auth_on.get(
                "/api/proxy/config",
                headers={"Authorization": FAKE_BEARER},
            )
        assert resp.status_code == 401

    def test_vault_store_requires_auth(self, client_auth_on):
        """POST /api/proxy/vault/keys without token → 401."""
        resp = client_auth_on.post(
            "/api/proxy/vault/keys",
            json={"name": "FAKE_API_KEY", "value": "sk-fake-value"},
        )
        assert resp.status_code == 401

    def test_vault_store_with_valid_token(self, client_auth_on):
        """POST /api/proxy/vault/keys with valid token → 201."""
        mock_resp = MagicMock()
        mock_resp.status_code = 200
        mock_resp.json.return_value = {"id": FAKE_USER_ID}

        with patch("backend.app.middleware.auth.httpx.AsyncClient") as mock_cls:
            mock_client = AsyncMock()
            mock_cls.return_value.__aenter__.return_value = mock_client
            mock_client.get = AsyncMock(return_value=mock_resp)

            resp = client_auth_on.post(
                "/api/proxy/vault/keys",
                json={"name": "FAKE_API_KEY", "value": "sk-fake-value"},
                headers={"Authorization": FAKE_BEARER},
            )
        assert resp.status_code == 201
        data = resp.json()
        assert data["success"] is True
        assert data["name"] == "FAKE_API_KEY"

    def test_vault_delete_requires_auth(self, client_auth_on):
        """DELETE /api/proxy/vault/keys/{name} without token → 401."""
        resp = client_auth_on.delete("/api/proxy/vault/keys/SOME_KEY")
        assert resp.status_code == 401
