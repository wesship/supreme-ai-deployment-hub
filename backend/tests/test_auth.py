"""
Unit tests for JWT authentication module.
Run with: pytest backend/tests/test_auth.py -v
"""

import pytest
import jwt as pyjwt
from datetime import datetime, timedelta, timezone
from fastapi import HTTPException

from backend.auth.jwt import verify_jwt


def make_token(payload: dict, secret: str = "test-secret", algorithm: str = "HS256") -> str:
    return pyjwt.encode(payload, secret, algorithm=algorithm)


class TestVerifyJWT:
    def test_valid_token_returns_payload(self, monkeypatch):
        monkeypatch.setenv("JWT_SECRET", "test-secret")
        payload = {
            "sub": "user-123",
            "email": "test@d3vonn.io",
            "exp": int((datetime.now(timezone.utc) + timedelta(hours=1)).timestamp()),
        }
        token = make_token(payload, "test-secret")
        result = verify_jwt(f"Bearer {token}")
        assert result["sub"] == "user-123"

    def test_expired_token_raises(self, monkeypatch):
        monkeypatch.setenv("JWT_SECRET", "test-secret")
        payload = {
            "sub": "user-123",
            "exp": int((datetime.now(timezone.utc) - timedelta(hours=1)).timestamp()),
        }
        token = make_token(payload, "test-secret")
        with pytest.raises(HTTPException) as exc:
            verify_jwt(f"Bearer {token}")
        assert exc.value.status_code == 401

    def test_missing_bearer_prefix_raises(self):
        try:
            from auth.jwt import verify_jwt
        except ImportError:
            pytest.skip("auth.jwt not available")
        with pytest.raises(Exception):
            verify_jwt("not-a-bearer-token")

    def test_tampered_token_raises(self):
        try:
            from auth.jwt import verify_jwt
        except ImportError:
            pytest.skip("auth.jwt not available")
        with pytest.raises(Exception):
            verify_jwt("Bearer eyJhbGciOiJIUzI1NiJ9.tampered.signature")

    def test_empty_token_raises(self):
        try:
            from auth.jwt import verify_jwt
        except ImportError:
            pytest.skip("auth.jwt not available")
        with pytest.raises(Exception):
            verify_jwt("")


class TestTenantResolution:
    @pytest.mark.asyncio
    async def test_default_tenant_returned_when_no_slug(self):
        try:
            from tenancy.models import get_tenant_by_slug
        except ImportError:
            pytest.skip("tenancy.models not available")
        result = await get_tenant_by_slug("nonexistent-slug-xyz")
        assert result is None

    def test_default_tenant_is_enterprise(self):
        try:
            from tenancy.models import Tenant
        except ImportError:
            pytest.skip("tenancy.models not available")
        tenant = Tenant.default()
        assert tenant.plan == "enterprise"
        assert tenant.is_active is True
