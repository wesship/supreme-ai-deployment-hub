"""Minimal Supabase REST persistence adapter for assurance records."""
from __future__ import annotations

import logging
from typing import Any

import httpx

from backend.app.config import get_settings

logger = logging.getLogger(__name__)


class AssuranceStore:
    """Server-only persistence adapter. The browser never talks to these tables."""

    def __init__(self) -> None:
        self.settings = get_settings()

    @property
    def configured(self) -> bool:
        return bool(self.settings.supabase_url and self.settings.supabase_service_role_key)

    def _headers(self, *, return_representation: bool = False) -> dict[str, str]:
        headers = {
            "apikey": self.settings.supabase_service_role_key,
            "Authorization": f"Bearer {self.settings.supabase_service_role_key}",
            "Content-Type": "application/json",
        }
        if return_representation:
            headers["Prefer"] = "return=representation"
        return headers

    def _url(self, table: str) -> str:
        return f"{self.settings.supabase_url.rstrip('/')}/rest/v1/{table}"

    async def list(self, table: str, *, params: dict[str, str] | None = None) -> list[dict[str, Any]]:
        if not self.configured:
            return []
        async with httpx.AsyncClient(timeout=10.0) as client:
            response = await client.get(self._url(table), headers=self._headers(), params=params)
        response.raise_for_status()
        body = response.json()
        return body if isinstance(body, list) else []

    async def one(self, table: str, *, params: dict[str, str]) -> dict[str, Any] | None:
        rows = await self.list(table, params={**params, "limit": "1"})
        return rows[0] if rows else None

    async def insert(self, table: str, row: dict[str, Any]) -> dict[str, Any]:
        if not self.configured:
            raise RuntimeError("Assurance persistence is not configured")
        async with httpx.AsyncClient(timeout=10.0) as client:
            response = await client.post(
                self._url(table), headers=self._headers(return_representation=True), json=row
            )
        response.raise_for_status()
        body = response.json()
        return body[0] if isinstance(body, list) and body else row

    async def update(self, table: str, *, filters: dict[str, str], patch: dict[str, Any]) -> dict[str, Any]:
        if not self.configured:
            raise RuntimeError("Assurance persistence is not configured")
        async with httpx.AsyncClient(timeout=10.0) as client:
            response = await client.patch(
                self._url(table),
                headers=self._headers(return_representation=True),
                params=filters,
                json=patch,
            )
        response.raise_for_status()
        body = response.json()
        return body[0] if isinstance(body, list) and body else patch
