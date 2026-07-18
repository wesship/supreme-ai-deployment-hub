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
    rest_timeout_seconds: float = 10.0
    dispatch_timeout_seconds: float = 15.0

    @classmethod
    def from_env(cls) -> "HermesInfrastructureConfig":
        return cls(
            supabase_url=os.getenv("SUPABASE_URL", "").rstrip("/"),
            service_role_key=os.getenv("SUPABASE_SERVICE_ROLE_KEY", ""),
            webhook_secret=os.getenv("HERMES_WEBHOOK_SECRET", ""),
            internal_api_key=os.getenv("HERMES_INTERNAL_API_KEY", ""),
            rest_timeout_seconds=float(os.getenv("HERMES_REST_TIMEOUT_SECONDS", "10")),
            dispatch_timeout_seconds=float(os.getenv("HERMES_DISPATCH_TIMEOUT_SECONDS", "15")),
        )

    @property
    def supabase_configured(self) -> bool:
        return bool(self.supabase_url and self.service_role_key)

    @property
    def dispatch_configured(self) -> bool:
        return bool(self.supabase_url and self.webhook_secret)

    def rest_url(self, table: str) -> str:
        return f"{self.supabase_url}/rest/v1/{table}"

    @property
    def enqueue_url(self) -> str:
        return f"{self.supabase_url}/functions/v1/enqueue-task"
