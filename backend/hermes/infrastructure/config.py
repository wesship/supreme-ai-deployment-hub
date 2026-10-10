"""Environment-backed configuration for Hermes infrastructure adapters."""
from __future__ import annotations

import os
from dataclasses import dataclass


@dataclass(frozen=True, slots=True)
class HermesInfrastructureConfig:
    supabase_url: str = ""
    service_role_key: str = ""
    webhook_secret: str = ""
    internal_api_key: str = ""
    internal_api_url: str = ""
    rest_timeout_seconds: float = 10.0
    dispatch_timeout_seconds: float = 15.0

    @classmethod
    def from_env(cls) -> "HermesInfrastructureConfig":
        raw_internal_api_url = (
            os.getenv("HERMES_INTERNAL_API_URL", "").strip()
            or os.getenv("RAILWAY_SERVICE_DEVONN_AI_API_URL", "").strip()
            or os.getenv("API_BASE_URL", "").strip()
            or "https://api.d3vonn.io"
        )
        if raw_internal_api_url and "://" not in raw_internal_api_url:
            scheme = "http" if raw_internal_api_url.endswith(".railway.internal") else "https"
            raw_internal_api_url = f"{scheme}://{raw_internal_api_url}"
        return cls(
            supabase_url=os.getenv("SUPABASE_URL", "").rstrip("/"),
            service_role_key=os.getenv("SUPABASE_SERVICE_ROLE_KEY", ""),
            webhook_secret=os.getenv("HERMES_WEBHOOK_SECRET", ""),
            internal_api_key=os.getenv("HERMES_INTERNAL_API_KEY", ""),
            internal_api_url=raw_internal_api_url.rstrip("/"),
            rest_timeout_seconds=float(os.getenv("HERMES_REST_TIMEOUT_SECONDS", "10")),
            dispatch_timeout_seconds=float(os.getenv("HERMES_DISPATCH_TIMEOUT_SECONDS", "15")),
        )

    @property
    def supabase_configured(self) -> bool:
        return bool(self.supabase_url and self.service_role_key)

    @property
    def dispatch_configured(self) -> bool:
        return bool(self.supabase_url and self.webhook_secret)

    @property
    def internal_dispatch_configured(self) -> bool:
        return bool(self.internal_api_url and self.internal_api_key)

    def rest_url(self, table: str) -> str:
        return f"{self.supabase_url}/rest/v1/{table}"

    @property
    def enqueue_url(self) -> str:
        return f"{self.supabase_url}/functions/v1/enqueue-task"

    @property
    def internal_execute_url(self) -> str:
        return f"{self.internal_api_url}/api/hermes/internal/execute"
