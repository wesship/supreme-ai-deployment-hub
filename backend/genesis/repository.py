"""Supabase REST repository for the Genesis platform.

The backend uses the service role only inside this trusted process and performs explicit
project-role checks before governed project mutations. Database RLS remains enabled as
defense in depth for direct user-scoped access.
"""
from __future__ import annotations

import os
from collections.abc import Collection
from typing import Any
from uuid import UUID

import httpx
from fastapi import HTTPException, status


class GenesisRepository:
    def __init__(self) -> None:
        self.base_url = os.getenv("SUPABASE_URL", "").rstrip("/")
        self.service_key = os.getenv("SUPABASE_SERVICE_ROLE_KEY", "")

    def _ensure_configured(self) -> None:
        if not self.base_url or not self.service_key:
            raise HTTPException(
                status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
                detail="Genesis persistence is not configured. Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY.",
            )

    @property
    def _headers(self) -> dict[str, str]:
        self._ensure_configured()
        return {
            "apikey": self.service_key,
            "Authorization": f"Bearer {self.service_key}",
            "Content-Type": "application/json",
        }

    async def _request(
        self,
        method: str,
        resource: str,
        *,
        params: dict[str, str] | None = None,
        payload: Any = None,
        prefer: str | None = None,
    ) -> Any:
        headers = self._headers.copy()
        if prefer:
            headers["Prefer"] = prefer
        try:
            async with httpx.AsyncClient(timeout=15.0) as client:
                response = await client.request(
                    method,
                    f"{self.base_url}/rest/v1/{resource.lstrip('/')}",
                    headers=headers,
                    params=params,
                    json=payload,
                )
        except httpx.RequestError as exc:
            raise HTTPException(
                status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
                detail="Genesis persistence service is unavailable.",
            ) from exc

        if response.status_code >= 400:
            detail: Any
            try:
                detail = response.json()
            except ValueError:
                detail = response.text
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT if response.status_code == 409 else status.HTTP_502_BAD_GATEWAY,
                detail={"message": "Genesis persistence request failed", "upstream": detail},
            )
        if response.status_code == 204 or not response.content:
            return None
        return response.json()

    async def get_project_role(self, project_id: UUID | str, user_id: str) -> str | None:
        project_rows = await self._request(
            "GET",
            "genesis_projects",
            params={"id": f"eq.{project_id}", "select": "id,owner_id", "limit": "1"},
        )
        if not project_rows:
            return None
        if str(project_rows[0].get("owner_id")) == user_id:
            return "owner"
        member_rows = await self._request(
            "GET",
            "genesis_project_members",
            params={
                "project_id": f"eq.{project_id}",
                "user_id": f"eq.{user_id}",
                "select": "role",
                "limit": "1",
            },
        )
        if not member_rows:
            return None
        role = member_rows[0].get("role")
        return str(role) if role else None

    async def has_project_access(self, project_id: UUID | str, user_id: str) -> bool:
        return await self.get_project_role(project_id, user_id) is not None

    async def require_project_access(self, project_id: UUID | str, user_id: str) -> str:
        role = await self.get_project_role(project_id, user_id)
        if role is None:
            raise HTTPException(status_code=404, detail="Genesis project not found or access denied.")
        return role

    async def require_project_role(
        self,
        project_id: UUID | str,
        user_id: str,
        allowed_roles: Collection[str],
    ) -> str:
        role = await self.require_project_access(project_id, user_id)
        if role not in allowed_roles:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Genesis project role '{role}' cannot perform this action.",
            )
        return role

    async def list_projects(self, user_id: str) -> list[dict[str, Any]]:
        owned = await self._request(
            "GET",
            "genesis_projects",
            params={
                "owner_id": f"eq.{user_id}",
                "select": "*",
                "order": "updated_at.desc",
            },
        )
        memberships = await self._request(
            "GET",
            "genesis_project_members",
            params={"user_id": f"eq.{user_id}", "select": "project_id"},
        )
        member_ids = [str(row["project_id"]) for row in memberships if row.get("project_id")]
        shared: list[dict[str, Any]] = []
        if member_ids:
            shared = await self._request(
                "GET",
                "genesis_projects",
                params={
                    "id": f"in.({','.join(member_ids)})",
                    "select": "*",
                    "order": "updated_at.desc",
                },
            )
        unique = {str(row["id"]): row for row in [*owned, *shared]}
        return sorted(unique.values(), key=lambda row: str(row.get("updated_at", "")), reverse=True)

    async def create_project(self, payload: dict[str, Any], user_id: str) -> dict[str, Any]:
        rows = await self._request(
            "POST",
            "genesis_projects",
            payload={**payload, "owner_id": user_id},
            prefer="return=representation",
        )
        project = rows[0]
        await self._request(
            "POST",
            "genesis_project_members",
            payload={"project_id": project["id"], "user_id": user_id, "role": "owner"},
            prefer="resolution=merge-duplicates,return=minimal",
        )
        await self.emit_event(
            project_id=project["id"],
            event_type="project.created",
            aggregate_type="project",
            aggregate_id=project["id"],
            actor_type="user",
            actor_id=user_id,
            payload={"title": project["title"], "project_type": project["project_type"]},
        )
        return project

    async def command_center(self, project_id: UUID | str, user_id: str) -> dict[str, Any]:
        await self.require_project_access(project_id, user_id)
        result = await self._request(
            "POST",
            "rpc/genesis_project_command_center",
            payload={"p_project_id": str(project_id)},
        )
        return result or {}

    async def list_rows(
        self,
        table: str,
        project_id: UUID | str,
        user_id: str,
        *,
        order: str = "created_at.desc",
        limit: int = 100,
        extra_params: dict[str, str] | None = None,
    ) -> list[dict[str, Any]]:
        await self.require_project_access(project_id, user_id)
        params = {
            "project_id": f"eq.{project_id}",
            "select": "*",
            "order": order,
            "limit": str(limit),
        }
        if extra_params:
            params.update(extra_params)
        return await self._request("GET", table, params=params)

    async def insert_project_row(
        self,
        table: str,
        project_id: UUID | str,
        user_id: str,
        payload: dict[str, Any],
    ) -> dict[str, Any]:
        await self.require_project_access(project_id, user_id)
        rows = await self._request(
            "POST",
            table,
            payload={**payload, "project_id": str(project_id)},
            prefer="return=representation",
        )
        return rows[0]

    async def update_row(
        self,
        table: str,
        row_id: UUID | str,
        payload: dict[str, Any],
    ) -> dict[str, Any]:
        rows = await self._request(
            "PATCH",
            table,
            params={"id": f"eq.{row_id}"},
            payload=payload,
            prefer="return=representation",
        )
        if not rows:
            raise HTTPException(status_code=404, detail=f"{table} row not found")
        return rows[0]

    async def get_row(self, table: str, row_id: UUID | str) -> dict[str, Any] | None:
        rows = await self._request(
            "GET",
            table,
            params={"id": f"eq.{row_id}", "select": "*", "limit": "1"},
        )
        return rows[0] if rows else None

    @staticmethod
    def _single_rpc_row(result: Any) -> dict[str, Any] | None:
        if isinstance(result, dict):
            return result
        if isinstance(result, list):
            return result[0] if result else None
        return None

    async def transition_task_atomic(
        self,
        *,
        task_id: UUID | str,
        expected_status: str,
        new_status: str,
        output: dict[str, Any] | None,
        completed_at: str | None,
        actor_id: UUID | str,
        reason: str | None,
    ) -> dict[str, Any]:
        result = await self._request(
            "POST",
            "rpc/genesis_transition_task",
            payload={
                "p_task_id": str(task_id),
                "p_expected_status": expected_status,
                "p_new_status": new_status,
                "p_output": output,
                "p_completed_at": completed_at,
                "p_actor_id": str(actor_id),
                "p_reason": reason,
            },
        )
        row = self._single_rpc_row(result)
        if row is None:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="Task changed concurrently; reload it before retrying the transition.",
            )
        return row

    async def decide_approval_atomic(
        self,
        *,
        approval_id: UUID | str,
        decision: str,
        decided_by_user_id: UUID | str,
        notes: str | None,
        conditions: dict[str, Any],
    ) -> dict[str, Any]:
        result = await self._request(
            "POST",
            "rpc/genesis_decide_approval",
            payload={
                "p_approval_id": str(approval_id),
                "p_decision": decision,
                "p_decided_by_user_id": str(decided_by_user_id),
                "p_notes": notes,
                "p_conditions": conditions,
            },
        )
        row = self._single_rpc_row(result)
        if row is None:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="Approval has already been decided.",
            )
        return row

    async def emit_event(
        self,
        *,
        project_id: UUID | str,
        event_type: str,
        aggregate_type: str,
        aggregate_id: UUID | str,
        actor_type: str,
        actor_id: UUID | str | None,
        payload: dict[str, Any] | None = None,
        correlation_id: UUID | str | None = None,
        causation_id: UUID | str | None = None,
    ) -> str:
        rpc_payload = {
            "p_project_id": str(project_id),
            "p_event_type": event_type,
            "p_aggregate_type": aggregate_type,
            "p_aggregate_id": str(aggregate_id),
            "p_actor_type": actor_type,
            "p_actor_id": str(actor_id) if actor_id else None,
            "p_payload": payload or {},
        }
        if correlation_id:
            rpc_payload["p_correlation_id"] = str(correlation_id)
        if causation_id:
            rpc_payload["p_causation_id"] = str(causation_id)
        result = await self._request("POST", "rpc/genesis_emit_event", payload=rpc_payload)
        return str(result)


repository = GenesisRepository()
