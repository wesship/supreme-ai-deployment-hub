"""Small async Supabase REST adapter shared by Hermes runtime and OCC routes."""
from __future__ import annotations

from typing import Any

import httpx

from backend.hermes.infrastructure.config import HermesInfrastructureConfig


class SupabaseRestClient:
    def __init__(self, config: HermesInfrastructureConfig | None = None) -> None:
        self.config = config or HermesInfrastructureConfig.from_env()

    @property
    def configured(self) -> bool:
        return self.config.supabase_configured

    def headers(self, *, return_representation: bool = False, count_exact: bool = False) -> dict[str, str]:
        headers = {
            "apikey": self.config.service_role_key,
            "Authorization": f"Bearer {self.config.service_role_key}",
            "Content-Type": "application/json",
        }
        preferences: list[str] = []
        if return_representation:
            preferences.append("return=representation")
        if count_exact:
            preferences.append("count=exact")
        if preferences:
            headers["Prefer"] = ",".join(preferences)
        return headers

    async def get(self, table: str, params: dict[str, Any]) -> list[dict[str, Any]]:
        if not self.configured:
            return []
        async with httpx.AsyncClient(timeout=self.config.rest_timeout_seconds) as client:
            response = await client.get(self.config.rest_url(table), headers=self.headers(), params=params)
        response.raise_for_status()
        return response.json()

    async def post(self, table: str, payload: dict[str, Any]) -> dict[str, Any]:
        if not self.configured:
            return {}
        async with httpx.AsyncClient(timeout=self.config.rest_timeout_seconds) as client:
            response = await client.post(
                self.config.rest_url(table),
                headers=self.headers(return_representation=True),
                json=payload,
            )
        response.raise_for_status()
        data = response.json()
        return data[0] if isinstance(data, list) and data else data

    async def rpc(self, function_name: str, params: dict[str, Any]) -> Any:
        """Invoke a backend-only PostgreSQL RPC through Supabase REST."""
        if not self.configured:
            return None
        endpoint = f"{self.config.supabase_url}/rest/v1/rpc/{function_name}"
        async with httpx.AsyncClient(timeout=self.config.rest_timeout_seconds) as client:
            response = await client.post(
                endpoint,
                headers=self.headers(),
                json=params,
            )
        response.raise_for_status()
        if response.status_code == 204 or not response.content:
            return None
        return response.json()

    async def patch(
        self,
        table: str,
        row_id: str,
        payload: dict[str, Any],
        *,
        filters: dict[str, str] | None = None,
    ) -> dict[str, Any]:
        if not self.configured:
            return {}
        params: dict[str, str] = {"id": f"eq.{row_id}"}
        if filters:
            params.update(filters)
        async with httpx.AsyncClient(timeout=self.config.rest_timeout_seconds) as client:
            response = await client.patch(
                self.config.rest_url(table),
                headers=self.headers(return_representation=True),
                params=params,
                json=payload,
            )
        response.raise_for_status()
        if response.status_code == 204 or not response.content:
            return {}
        data = response.json()
        if isinstance(data, list):
            return data[0] if data else {}
        return data

    async def count(self, table: str, filters: dict[str, str] | None = None) -> int:
        if not self.configured:
            return -1
        params: dict[str, Any] = {"select": "id"}
        if filters:
            params.update(filters)
        async with httpx.AsyncClient(timeout=self.config.rest_timeout_seconds) as client:
            response = await client.get(
                self.config.rest_url(table),
                headers=self.headers(count_exact=True),
                params=params,
            )
        if response.status_code != 200:
            return -1
        content_range = response.headers.get("content-range", "")
        try:
            return int(content_range.split("/")[-1])
        except (ValueError, IndexError):
            return len(response.json())
