"""Sandbox HTTP FHIR adapter for HealthOS.

This adapter refuses to operate unless HealthOS is synthetic-only or an explicit
real-data enablement gate is present. It is intended for Medplum/HAPI sandbox use.
"""
from typing import Any
import httpx

from backend.healthos.settings import HealthOSSettings


class HTTPFHIRAdapter:
    def __init__(self, settings: HealthOSSettings, token: str | None = None):
        if not settings.enabled or not settings.fhir_enabled:
            raise RuntimeError("HealthOS FHIR adapter is disabled")
        if not settings.fhir_base_url:
            raise RuntimeError("HEALTHOS_FHIR_BASE_URL is required")
        if not settings.synthetic_only:
            raise RuntimeError("Real-data FHIR mode is not enabled in Gate 4")
        self.base_url = settings.fhir_base_url.rstrip("/")
        self.token = token

    def _headers(self) -> dict[str, str]:
        headers = {"Accept": "application/fhir+json"}
        if self.token:
            headers["Authorization"] = f"Bearer {self.token}"
        return headers

    async def get_resource(self, resource_type: str, resource_id: str) -> dict[str, Any]:
        async with httpx.AsyncClient(timeout=10.0) as client:
            response = await client.get(
                f"{self.base_url}/{resource_type}/{resource_id}",
                headers=self._headers(),
            )
            response.raise_for_status()
            return response.json()

    async def search(self, resource_type: str, params: dict[str, str]) -> dict[str, Any]:
        async with httpx.AsyncClient(timeout=10.0) as client:
            response = await client.get(
                f"{self.base_url}/{resource_type}",
                headers=self._headers(),
                params=params,
            )
            response.raise_for_status()
            return response.json()
