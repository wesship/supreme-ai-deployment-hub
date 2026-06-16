from __future__ import annotations

import os
from typing import Any

import httpx


class CommandStore:
    def __init__(self) -> None:
        self.base_url = os.getenv("SUPABASE_URL", "").rstrip("/")
        self.service_key = os.getenv("SUPABASE_SERVICE_ROLE_KEY", "")

    @property
    def configured(self) -> bool:
        return bool(self.base_url and self.service_key)

    def _headers(self, prefer: str = "return=representation") -> dict[str, str]:
        return {
            "apikey": self.service_key,
            "Authorization": f"Bearer {self.service_key}",
            "Content-Type": "application/json",
            "Prefer": prefer,
        }

    async def upsert_plan(self, row: dict[str, Any]) -> dict[str, Any]:
        if not self.configured:
            return row
        async with httpx.AsyncClient(timeout=15) as client:
            response = await client.post(
                f"{self.base_url}/rest/v1/command_plans?on_conflict=workspace_id,idempotency_key",
                headers=self._headers("resolution=merge-duplicates,return=representation"),
                json=row,
            )
        response.raise_for_status()
        payload = response.json()
        return payload[0] if payload else row

    async def add_review(self, row: dict[str, Any]) -> dict[str, Any]:
        if not self.configured:
            return row
        async with httpx.AsyncClient(timeout=15) as client:
            response = await client.post(
                f"{self.base_url}/rest/v1/command_reviews?on_conflict=workspace_id,idempotency_key",
                headers=self._headers("resolution=ignore-duplicates,return=representation"),
                json=row,
            )
        response.raise_for_status()
        payload = response.json()
        return payload[0] if payload else row

    async def add_event(self, row: dict[str, Any]) -> dict[str, Any]:
        if not self.configured:
            return row
        async with httpx.AsyncClient(timeout=15) as client:
            response = await client.post(
                f"{self.base_url}/rest/v1/command_execution_events?on_conflict=workspace_id,idempotency_key",
                headers=self._headers("resolution=ignore-duplicates,return=representation"),
                json=row,
            )
        response.raise_for_status()
        payload = response.json()
        return payload[0] if payload else row

    async def list_reviews(self, workspace_id: str, command_plan_id: str) -> list[dict[str, Any]]:
        if not self.configured:
            return []
        async with httpx.AsyncClient(timeout=15) as client:
            response = await client.get(
                f"{self.base_url}/rest/v1/command_reviews",
                headers=self._headers(),
                params={
                    "workspace_id": f"eq.{workspace_id}",
                    "command_plan_id": f"eq.{command_plan_id}",
                    "order": "created_at.asc",
                },
            )
        response.raise_for_status()
        return response.json()


command_store = CommandStore()
