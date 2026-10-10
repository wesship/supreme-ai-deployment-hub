"""HMAC-signed Hermes enqueue adapter."""
from __future__ import annotations

from typing import Any

import httpx

from backend.hermes.infrastructure.config import HermesInfrastructureConfig
from backend.hermes.infrastructure.signing import canonical_json, sign_payload


class HermesDispatchClient:
    def __init__(self, config: HermesInfrastructureConfig | None = None) -> None:
        self.config = config or HermesInfrastructureConfig.from_env()

    @property
    def configured(self) -> bool:
        return self.config.dispatch_configured

    async def enqueue(
        self,
        payload: dict[str, Any],
        *,
        include_service_authorization: bool = False,
        signature_header: str = "x-hermes-signature",
    ) -> dict[str, Any]:
        if not self.configured:
            return {"status": "skipped", "reason": "not_configured"}

        body = canonical_json(payload)
        headers = {
            "Content-Type": "application/json",
            signature_header: sign_payload(body, self.config.webhook_secret),
        }
        if include_service_authorization and self.config.service_role_key:
            headers["Authorization"] = f"Bearer {self.config.service_role_key}"

        async with httpx.AsyncClient(timeout=self.config.dispatch_timeout_seconds) as client:
            response = await client.post(
                self.config.enqueue_url,
                content=body,
                headers=headers,
            )
        response.raise_for_status()
        return response.json()
