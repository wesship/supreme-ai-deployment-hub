"""OPA-compatible HTTP policy adapter for HealthOS sandbox use."""
from typing import Any
import httpx

from backend.healthos.settings import HealthOSSettings


class HTTPPolicyAdapter:
    def __init__(self, settings: HealthOSSettings):
        if not settings.enabled or not settings.policy_enabled:
            raise RuntimeError("HealthOS policy adapter is disabled")
        if not settings.policy_url:
            raise RuntimeError("HEALTHOS_POLICY_URL is required")
        self.policy_url = settings.policy_url.rstrip("/")

    async def authorize(self, input_document: dict[str, Any]) -> dict[str, Any]:
        async with httpx.AsyncClient(timeout=5.0) as client:
            response = await client.post(
                self.policy_url,
                json={"input": input_document},
                headers={"Content-Type": "application/json"},
            )
            response.raise_for_status()
            payload = response.json()

        result = payload.get("result", payload)
        if isinstance(result, bool):
            return {"allow": result, "source": "opa"}
        if isinstance(result, dict):
            return {"source": "opa", **result}
        return {"allow": False, "source": "opa", "reason": "invalid policy response"}
