"""Fail-closed deployment configuration for the experimental single-tenant worker."""
from dataclasses import dataclass
import os


@dataclass(frozen=True)
class StagingConfig:
    tenant_id: str
    token: str
    host: str = "127.0.0.1"
    port: int = 8765

    @classmethod
    def from_environment(cls):
        tenant = os.environ.get("D3VONN_TEXT_ENGINE_TENANT_ID", "")
        token = os.environ.get("D3VONN_TEXT_ENGINE_TOKEN", "")
        if not tenant or len(tenant) > 128 or not all(
            c.isascii() and (c.isalnum() or c in "-_") for c in tenant
        ):
            raise ValueError("single-tenant staging identity is required")
        if len(token) < 32 or token.strip() != token:
            raise ValueError("staging bearer token must be at least 32 characters")
        if os.environ.get("D3VONN_TEXT_ENGINE_BACKEND", "cpu") != "cpu":
            raise ValueError("GPU execution is not certified")
        if os.environ.get("D3VONN_TEXT_ENGINE_MULTI_TENANT", "false").lower() != "false":
            raise ValueError("multi-tenant mode is not supported")
        return cls(tenant_id=tenant, token=token)
