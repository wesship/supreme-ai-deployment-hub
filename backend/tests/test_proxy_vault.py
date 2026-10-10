"""
Tests for the proxy vault router (/api/proxy/*).
"""
import sys
import os
import pytest
from unittest.mock import patch, MagicMock
from fastapi.testclient import TestClient
from fastapi import FastAPI

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

from backend.app.routers.proxy_vault import router as vault_router
from backend.app.middleware.auth import get_current_user_id

test_app = FastAPI()
test_app.include_router(vault_router, prefix="/api")


async def _mock_user() -> str:
    return "test-user-id"


@pytest.fixture(autouse=True)
def override_auth():
    test_app.dependency_overrides[get_current_user_id] = _mock_user
    yield
    test_app.dependency_overrides.clear()


@pytest.fixture
def client():
    return TestClient(test_app)


class TestProxyConfig:
    def test_config_returns_200(self, client):
        resp = client.get("/api/proxy/config")
        assert resp.status_code == 200

    def test_config_has_required_fields(self, client):
        data = client.get("/api/proxy/config").json()
        assert "mode" in data
        assert "status" in data
        assert "vaultPath" in data
        assert "keysConfigured" in data
        assert "vaultEncrypted" in data

    def test_config_status_is_active(self, client):
        data = client.get("/api/proxy/config").json()
        assert data["status"] == "active"

    def test_config_vault_encrypted_false_without_secret(self, client):
        with patch.dict(os.environ, {}, clear=False):
            os.environ.pop("API_KEY_VAULT_SECRET", None)
            data = client.get("/api/proxy/config").json()
        assert data["vaultEncrypted"] is False


class TestVaultKeys:
    def test_list_keys_returns_200(self, client):
        resp = client.get("/api/proxy/vault/keys")
        assert resp.status_code == 200

    def test_list_keys_has_keys_and_total(self, client):
        data = client.get("/api/proxy/vault/keys").json()
        assert "keys" in data
        assert "total" in data
        assert isinstance(data["keys"], list)

    def test_store_key_returns_201(self, client):
        resp = client.post("/api/proxy/vault/keys", json={"name": "TEST_API_KEY", "value": "sk-test-123"})
        assert resp.status_code == 201

    def test_store_key_invalid_name_rejected(self, client):
        resp = client.post("/api/proxy/vault/keys", json={"name": "invalid-name", "value": "sk-test"})
        assert resp.status_code == 422

    def test_delete_missing_key_returns_404(self, client):
        resp = client.delete("/api/proxy/vault/keys/NONEXISTENT_KEY")
        assert resp.status_code == 404
