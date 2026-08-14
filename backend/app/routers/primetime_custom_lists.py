"""Governed PRIMETIME Custom Lists API.

Reads are workspace-scoped through the existing Release 1 membership boundary.
Every mutation is executed by a service-role-only PostgreSQL RPC that performs the
business change and immutable PRIMETIME audit insert in the same transaction.
"""
from __future__ import annotations

from typing import Any

import httpx
from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel, Field, field_validator

from ..middleware.auth import get_current_user_id
from .primetime_release1 import (
    _get_supabase_base,
    _headers,
    _membership_required,
    _require_role,
    _validate_uuid,
)

router = APIRouter(prefix="/primetime/v1", tags=["primetime-custom-lists"])

_TABLES = {
    "custom_lists": "primetime_custom_lists",
    "custom_list_members": "primetime_custom_list_members",
}
_WRITE_ROLES = {"representative", "manager", "workspace_admin"}
_ARCHIVE_ROLES = {"manager", "workspace_admin"}


def _path(table: str) -> str:
    try:
        return f"/rest/v1/{_TABLES[table]}"
    except KeyError as exc:
        raise HTTPException(status_code=400, detail="Unknown Custom Lists table") from exc


async def _query(table: str, params: dict[str, str]) -> list[dict[str, Any]]:
    async with httpx.AsyncClient(timeout=10) as client:
        response = await client.get(
            f"{_get_supabase_base()}{_path(table)}",
            headers=_headers(),
            params=params,
        )
    if response.status_code >= 400:
        raise HTTPException(status_code=502, detail="PRIMETIME Custom Lists storage read failed")
    payload = response.json()
    return payload if isinstance(payload, list) else []


async def _rpc(name: str, payload: dict[str, Any]) -> dict[str, Any]:
    async with httpx.AsyncClient(timeout=10) as client:
        response = await client.post(
            f"{_get_supabase_base()}/rest/v1/rpc/{name}",
            headers=_headers(),
            json=payload,
        )

    if response.status_code >= 400:
        try:
            error = response.json()
        except ValueError:
            error = {}
        code = str(error.get("code", ""))
        message = str(error.get("message", "Custom Lists request rejected"))
        if code == "23505":
            raise HTTPException(status_code=409, detail="An active custom list or membership already exists")
        if code == "42501":
            raise HTTPException(status_code=403, detail=message)
        if code == "P0002":
            raise HTTPException(status_code=404, detail=message)
        if code == "P0001":
            raise HTTPException(status_code=422, detail=message)
        if 400 <= response.status_code < 500:
            raise HTTPException(status_code=response.status_code, detail="Custom Lists request rejected")
        raise HTTPException(status_code=502, detail="PRIMETIME Custom Lists mutation failed")

    result = response.json() if response.content else {}
    if isinstance(result, dict):
        return result
    if isinstance(result, list) and result and isinstance(result[0], dict):
        return result[0]
    raise HTTPException(status_code=502, detail="PRIMETIME Custom Lists RPC returned an invalid response")


class _WorkspaceBody(BaseModel):
    workspace_id: str


class CustomListCreate(_WorkspaceBody):
    display_name: str = Field(min_length=1, max_length=120)
    description: str = Field(default="", max_length=500)

    @field_validator("display_name")
    @classmethod
    def normalize_display_name(cls, value: str) -> str:
        normalized = value.strip()
        if not normalized:
            raise ValueError("display_name must contain non-whitespace characters")
        return normalized

    @field_validator("description")
    @classmethod
    def normalize_description(cls, value: str) -> str:
        return value.strip()


class CustomListUpdate(_WorkspaceBody):
    display_name: str | None = Field(default=None, min_length=1, max_length=120)
    description: str | None = Field(default=None, max_length=500)

    @field_validator("display_name")
    @classmethod
    def normalize_optional_display_name(cls, value: str | None) -> str | None:
        if value is None:
            return None
        normalized = value.strip()
        if not normalized:
            raise ValueError("display_name must contain non-whitespace characters")
        return normalized

    @field_validator("description")
    @classmethod
    def normalize_optional_description(cls, value: str | None) -> str | None:
        return None if value is None else value.strip()


class CustomListMemberChange(_WorkspaceBody):
    person_id: str


async def _context(workspace_id: str, user_id: str) -> dict[str, Any]:
    return await _membership_required(_validate_uuid(workspace_id, "workspace_id"), user_id)


@router.get("/custom-lists")
async def list_custom_lists(
    workspace_id: str = Query(...),
    include_archived: bool = False,
    user_id: str = Depends(get_current_user_id),
):
    context = await _context(workspace_id, user_id)
    params = {
        "select": "id,workspace_id,display_name,description,archived_at,created_by,updated_by,created_at,updated_at",
        "workspace_id": f"eq.{context['workspace_id']}",
        "order": "display_name.asc",
        "limit": "500",
    }
    if not include_archived:
        params["archived_at"] = "is.null"

    lists = await _query("custom_lists", params)
    members = await _query(
        "custom_list_members",
        {
            "select": "custom_list_id",
            "workspace_id": f"eq.{context['workspace_id']}",
            "removed_at": "is.null",
            "limit": "5000",
        },
    )
    counts: dict[str, int] = {}
    for member in members:
        key = str(member.get("custom_list_id", ""))
        counts[key] = counts.get(key, 0) + 1
    return [{**item, "record_count": counts.get(str(item.get("id")), 0)} for item in lists]


@router.post("/custom-lists")
async def create_custom_list(body: CustomListCreate, user_id: str = Depends(get_current_user_id)):
    context = await _context(body.workspace_id, user_id)
    _require_role(context, _WRITE_ROLES)
    return await _rpc(
        "primetime_create_custom_list",
        {
            "p_workspace_id": context["workspace_id"],
            "p_actor_id": _validate_uuid(user_id, "user_id"),
            "p_display_name": body.display_name,
            "p_description": body.description,
        },
    )


@router.patch("/custom-lists/{list_id}")
async def update_custom_list(list_id: str, body: CustomListUpdate, user_id: str = Depends(get_current_user_id)):
    context = await _context(body.workspace_id, user_id)
    _require_role(context, _WRITE_ROLES)
    if body.display_name is None and body.description is None:
        raise HTTPException(status_code=422, detail="At least one editable field is required")
    return await _rpc(
        "primetime_update_custom_list",
        {
            "p_workspace_id": context["workspace_id"],
            "p_actor_id": _validate_uuid(user_id, "user_id"),
            "p_list_id": _validate_uuid(list_id, "list_id"),
            "p_display_name": body.display_name,
            "p_description": body.description,
        },
    )


@router.post("/custom-lists/{list_id}/archive")
async def archive_custom_list(list_id: str, body: _WorkspaceBody, user_id: str = Depends(get_current_user_id)):
    context = await _context(body.workspace_id, user_id)
    _require_role(context, _ARCHIVE_ROLES)
    return await _rpc(
        "primetime_archive_custom_list",
        {
            "p_workspace_id": context["workspace_id"],
            "p_actor_id": _validate_uuid(user_id, "user_id"),
            "p_list_id": _validate_uuid(list_id, "list_id"),
        },
    )


@router.get("/custom-lists/{list_id}/members")
async def list_custom_list_members(
    list_id: str,
    workspace_id: str = Query(...),
    user_id: str = Depends(get_current_user_id),
):
    context = await _context(workspace_id, user_id)
    safe_list_id = _validate_uuid(list_id, "list_id")
    lists = await _query(
        "custom_lists",
        {
            "select": "id",
            "id": f"eq.{safe_list_id}",
            "workspace_id": f"eq.{context['workspace_id']}",
            "limit": "1",
        },
    )
    if not lists:
        raise HTTPException(status_code=404, detail="Custom list not found")
    return await _query(
        "custom_list_members",
        {
            "select": "id,workspace_id,custom_list_id,person_id,added_by,added_at,removed_by,removed_at",
            "workspace_id": f"eq.{context['workspace_id']}",
            "custom_list_id": f"eq.{safe_list_id}",
            "removed_at": "is.null",
            "order": "added_at.desc",
            "limit": "5000",
        },
    )


@router.post("/custom-lists/{list_id}/members")
async def add_custom_list_member(
    list_id: str,
    body: CustomListMemberChange,
    user_id: str = Depends(get_current_user_id),
):
    context = await _context(body.workspace_id, user_id)
    _require_role(context, _WRITE_ROLES)
    return await _rpc(
        "primetime_add_custom_list_member",
        {
            "p_workspace_id": context["workspace_id"],
            "p_actor_id": _validate_uuid(user_id, "user_id"),
            "p_list_id": _validate_uuid(list_id, "list_id"),
            "p_person_id": _validate_uuid(body.person_id, "person_id"),
        },
    )


@router.post("/custom-lists/{list_id}/members/{person_id}/remove")
async def remove_custom_list_member(
    list_id: str,
    person_id: str,
    body: _WorkspaceBody,
    user_id: str = Depends(get_current_user_id),
):
    context = await _context(body.workspace_id, user_id)
    _require_role(context, _WRITE_ROLES)
    return await _rpc(
        "primetime_remove_custom_list_member",
        {
            "p_workspace_id": context["workspace_id"],
            "p_actor_id": _validate_uuid(user_id, "user_id"),
            "p_list_id": _validate_uuid(list_id, "list_id"),
            "p_person_id": _validate_uuid(person_id, "person_id"),
        },
    )
