"""Governed PRIMETIME Custom Lists API.

This router reuses the Release 1 authentication, workspace-membership, role, UUID,
and append-only audit controls. Custom Lists remain workspace-scoped and use soft
archive/removal only.
"""
from __future__ import annotations

from datetime import datetime, timezone
from typing import Any

import httpx
from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel, Field

from ..middleware.auth import get_current_user_id
from .primetime_release1 import (
    _audit,
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
    "people": "primetime_people",
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
        response = await client.get(f"{_get_supabase_base()}{_path(table)}", headers=_headers(), params=params)
    if response.status_code >= 400:
        raise HTTPException(status_code=response.status_code, detail=response.text)
    return response.json()


async def _insert(table: str, payload: dict[str, Any]) -> dict[str, Any]:
    async with httpx.AsyncClient(timeout=10) as client:
        response = await client.post(f"{_get_supabase_base()}{_path(table)}", headers=_headers(), json=payload)
    if response.status_code >= 400:
        raise HTTPException(status_code=response.status_code, detail=response.text)
    rows = response.json() if response.content else []
    return rows[0] if rows else payload


async def _patch(table: str, params: dict[str, str], payload: dict[str, Any]) -> dict[str, Any]:
    async with httpx.AsyncClient(timeout=10) as client:
        response = await client.patch(
            f"{_get_supabase_base()}{_path(table)}",
            headers=_headers(),
            params=params,
            json=payload,
        )
    if response.status_code >= 400:
        raise HTTPException(status_code=response.status_code, detail=response.text)
    rows = response.json() if response.content else []
    return rows[0] if rows else payload


class CustomListCreate(BaseModel):
    workspace_id: str
    display_name: str = Field(min_length=1, max_length=120)
    description: str = Field(default="", max_length=500)


class CustomListUpdate(BaseModel):
    workspace_id: str
    display_name: str | None = Field(default=None, min_length=1, max_length=120)
    description: str | None = Field(default=None, max_length=500)


class CustomListArchive(BaseModel):
    workspace_id: str


class CustomListMemberChange(BaseModel):
    workspace_id: str
    person_id: str


def _now() -> str:
    return datetime.now(timezone.utc).isoformat()


async def _list_required(list_id: str, workspace_id: str) -> dict[str, Any]:
    safe_list = _validate_uuid(list_id, "list_id")
    rows = await _query(
        "custom_lists",
        {
            "select": "*",
            "id": f"eq.{safe_list}",
            "workspace_id": f"eq.{workspace_id}",
            "limit": "1",
        },
    )
    if not rows:
        raise HTTPException(status_code=404, detail="Custom list not found")
    return rows[0]


async def _person_required(person_id: str, workspace_id: str) -> None:
    safe_person = _validate_uuid(person_id, "person_id")
    rows = await _query(
        "people",
        {"select": "id", "id": f"eq.{safe_person}", "workspace_id": f"eq.{workspace_id}", "limit": "1"},
    )
    if not rows:
        raise HTTPException(status_code=404, detail="Person not found in workspace")


@router.get("/custom-lists")
async def list_custom_lists(
    workspace_id: str = Query(...),
    include_archived: bool = False,
    user_id: str = Depends(get_current_user_id),
):
    context = await _membership_required(workspace_id, user_id)
    params = {
        "select": "id,workspace_id,display_name,description,archived_at,created_by,updated_by,created_at,updated_at",
        "workspace_id": f"eq.{context['workspace_id']}",
        "order": "display_name.asc",
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
        },
    )
    counts: dict[str, int] = {}
    for member in members:
        key = str(member.get("custom_list_id", ""))
        counts[key] = counts.get(key, 0) + 1
    return [{**item, "record_count": counts.get(str(item.get("id")), 0)} for item in lists]


@router.post("/custom-lists")
async def create_custom_list(body: CustomListCreate, user_id: str = Depends(get_current_user_id)):
    context = await _membership_required(body.workspace_id, user_id)
    _require_role(context, _WRITE_ROLES)
    record = await _insert(
        "custom_lists",
        {
            "workspace_id": context["workspace_id"],
            "display_name": body.display_name.strip(),
            "description": body.description.strip(),
            "created_by": user_id,
            "updated_by": user_id,
        },
    )
    await _audit(context["workspace_id"], user_id, "crm.custom_list.created", "custom_list", record.get("id"))
    return {**record, "record_count": 0}


@router.patch("/custom-lists/{list_id}")
async def update_custom_list(list_id: str, body: CustomListUpdate, user_id: str = Depends(get_current_user_id)):
    context = await _membership_required(body.workspace_id, user_id)
    _require_role(context, _WRITE_ROLES)
    await _list_required(list_id, context["workspace_id"])
    changes: dict[str, Any] = {"updated_by": user_id, "updated_at": _now()}
    if body.display_name is not None:
        changes["display_name"] = body.display_name.strip()
    if body.description is not None:
        changes["description"] = body.description.strip()
    record = await _patch(
        "custom_lists",
        {"id": f"eq.{_validate_uuid(list_id, 'list_id')}", "workspace_id": f"eq.{context['workspace_id']}"},
        changes,
    )
    await _audit(context["workspace_id"], user_id, "crm.custom_list.updated", "custom_list", list_id)
    return record


@router.post("/custom-lists/{list_id}/archive")
async def archive_custom_list(list_id: str, body: CustomListArchive, user_id: str = Depends(get_current_user_id)):
    context = await _membership_required(body.workspace_id, user_id)
    _require_role(context, _ARCHIVE_ROLES)
    await _list_required(list_id, context["workspace_id"])
    archived_at = _now()
    record = await _patch(
        "custom_lists",
        {"id": f"eq.{_validate_uuid(list_id, 'list_id')}", "workspace_id": f"eq.{context['workspace_id']}"},
        {"archived_at": archived_at, "updated_at": archived_at, "updated_by": user_id},
    )
    await _audit(context["workspace_id"], user_id, "crm.custom_list.archived", "custom_list", list_id)
    return record


@router.get("/custom-lists/{list_id}/members")
async def list_custom_list_members(
    list_id: str,
    workspace_id: str = Query(...),
    user_id: str = Depends(get_current_user_id),
):
    context = await _membership_required(workspace_id, user_id)
    await _list_required(list_id, context["workspace_id"])
    return await _query(
        "custom_list_members",
        {
            "select": "id,workspace_id,custom_list_id,person_id,added_by,added_at",
            "workspace_id": f"eq.{context['workspace_id']}",
            "custom_list_id": f"eq.{_validate_uuid(list_id, 'list_id')}",
            "removed_at": "is.null",
            "order": "added_at.desc",
        },
    )


@router.post("/custom-lists/{list_id}/members")
async def add_custom_list_member(
    list_id: str,
    body: CustomListMemberChange,
    user_id: str = Depends(get_current_user_id),
):
    context = await _membership_required(body.workspace_id, user_id)
    _require_role(context, _WRITE_ROLES)
    await _list_required(list_id, context["workspace_id"])
    await _person_required(body.person_id, context["workspace_id"])
    record = await _insert(
        "custom_list_members",
        {
            "workspace_id": context["workspace_id"],
            "custom_list_id": _validate_uuid(list_id, "list_id"),
            "person_id": _validate_uuid(body.person_id, "person_id"),
            "added_by": user_id,
        },
    )
    await _audit(
        context["workspace_id"],
        user_id,
        "crm.custom_list.member_added",
        "custom_list_member",
        record.get("id"),
        {"custom_list_id": list_id, "person_id": body.person_id},
    )
    return record


@router.post("/custom-lists/{list_id}/members/{person_id}/remove")
async def remove_custom_list_member(
    list_id: str,
    person_id: str,
    body: CustomListArchive,
    user_id: str = Depends(get_current_user_id),
):
    context = await _membership_required(body.workspace_id, user_id)
    _require_role(context, _WRITE_ROLES)
    await _list_required(list_id, context["workspace_id"])
    removed_at = _now()
    record = await _patch(
        "custom_list_members",
        {
            "workspace_id": f"eq.{context['workspace_id']}",
            "custom_list_id": f"eq.{_validate_uuid(list_id, 'list_id')}",
            "person_id": f"eq.{_validate_uuid(person_id, 'person_id')}",
            "removed_at": "is.null",
        },
        {"removed_at": removed_at, "removed_by": user_id},
    )
    await _audit(
        context["workspace_id"],
        user_id,
        "crm.custom_list.member_removed",
        "custom_list_member",
        record.get("id"),
        {"custom_list_id": list_id, "person_id": person_id},
    )
    return record
