"""Authenticated Agent OS governance control-plane API.

All writes call atomic PostgreSQL RPC functions so the governance mutation and
its PRIMETIME audit evidence commit together or roll back together.
"""
from __future__ import annotations

from datetime import datetime, timezone
from typing import Any

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, Field, field_validator

from backend.app.middleware.auth import get_current_user_id
from backend.app.routers.primetime_release1 import _membership_required
from .control_plane_store import grant_approval, revoke_approval, set_workspace_policy

router = APIRouter(prefix="/governance/control", tags=["agent-governance"])

_POLICY_ROLES = {"workspace_admin"}
_APPROVAL_ROLES = {"workspace_admin", "manager", "compliance_reviewer"}
_MAX_APPROVAL_SECONDS = 7 * 24 * 60 * 60


class WorkspacePolicyMutationRequest(BaseModel):
    workspace_id: str = Field(min_length=1)
    kill_switch_enabled: bool
    disabled_agents: list[str] = Field(default_factory=list, max_length=100)
    reason: str | None = Field(default=None, max_length=1000)

    @field_validator("disabled_agents")
    @classmethod
    def validate_disabled_agents(cls, values: list[str]) -> list[str]:
        normalized: list[str] = []
        seen: set[str] = set()
        for raw in values:
            value = raw.strip()
            if not value:
                raise ValueError("disabled agent names must be nonblank")
            if value not in seen:
                normalized.append(value)
                seen.add(value)
        return normalized


class ApprovalGrantRequest(BaseModel):
    workspace_id: str = Field(min_length=1)
    action: str = Field(min_length=1, max_length=200)
    agent_name: str | None = Field(default=None, max_length=200)
    expires_at: datetime
    reason: str | None = Field(default=None, max_length=1000)
    metadata: dict[str, Any] = Field(default_factory=dict)

    @field_validator("action")
    @classmethod
    def validate_action(cls, value: str) -> str:
        value = value.strip()
        if not value:
            raise ValueError("action must be nonblank")
        return value

    @field_validator("agent_name")
    @classmethod
    def validate_agent_name(cls, value: str | None) -> str | None:
        if value is None:
            return None
        value = value.strip()
        if not value:
            raise ValueError("agent_name must be nonblank when provided")
        return value


class ApprovalRevokeRequest(BaseModel):
    workspace_id: str = Field(min_length=1)
    approval_id: str = Field(min_length=1)
    reason: str | None = Field(default=None, max_length=1000)


class GovernanceMutationResponse(BaseModel):
    workspace_id: str
    actor_id: str
    operation: str
    result: dict[str, Any]


async def _require_role(workspace_id: str, user_id: str, allowed: set[str]) -> dict[str, Any]:
    membership = await _membership_required(workspace_id, user_id)
    role = str(membership.get("role") or "")
    if role not in allowed:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Insufficient workspace governance role.",
        )
    return membership


@router.put("/policy", response_model=GovernanceMutationResponse)
async def update_workspace_policy(
    request: WorkspacePolicyMutationRequest,
    user_id: str = Depends(get_current_user_id),
):
    membership = await _require_role(request.workspace_id, user_id, _POLICY_ROLES)
    workspace_id = str(membership["workspace_id"])
    result = await set_workspace_policy(
        workspace_id=workspace_id,
        kill_switch_enabled=request.kill_switch_enabled,
        disabled_agents=set(request.disabled_agents),
        actor_user_id=user_id,
        reason=request.reason,
    )
    return GovernanceMutationResponse(
        workspace_id=workspace_id,
        actor_id=user_id,
        operation="workspace_policy_updated",
        result=result,
    )


@router.post("/approvals", response_model=GovernanceMutationResponse, status_code=status.HTTP_201_CREATED)
async def create_approval(
    request: ApprovalGrantRequest,
    user_id: str = Depends(get_current_user_id),
):
    membership = await _require_role(request.workspace_id, user_id, _APPROVAL_ROLES)
    workspace_id = str(membership["workspace_id"])

    now = datetime.now(timezone.utc)
    expires_at = request.expires_at
    if expires_at.tzinfo is None:
        expires_at = expires_at.replace(tzinfo=timezone.utc)
    else:
        expires_at = expires_at.astimezone(timezone.utc)
    lifetime = (expires_at - now).total_seconds()
    if lifetime <= 0:
        raise HTTPException(status_code=422, detail="Approval expiry must be in the future.")
    if lifetime > _MAX_APPROVAL_SECONDS:
        raise HTTPException(status_code=422, detail="Approval lifetime may not exceed 7 days.")

    result = await grant_approval(
        workspace_id=workspace_id,
        action=request.action,
        agent_name=request.agent_name,
        actor_user_id=user_id,
        expires_at=expires_at,
        reason=request.reason,
        metadata=request.metadata,
    )
    return GovernanceMutationResponse(
        workspace_id=workspace_id,
        actor_id=user_id,
        operation="approval_granted",
        result=result,
    )


@router.post("/approvals/revoke", response_model=GovernanceMutationResponse)
async def revoke_existing_approval(
    request: ApprovalRevokeRequest,
    user_id: str = Depends(get_current_user_id),
):
    membership = await _require_role(request.workspace_id, user_id, _APPROVAL_ROLES)
    workspace_id = str(membership["workspace_id"])
    result = await revoke_approval(
        workspace_id=workspace_id,
        approval_id=request.approval_id,
        actor_user_id=user_id,
        reason=request.reason,
    )
    return GovernanceMutationResponse(
        workspace_id=workspace_id,
        actor_id=user_id,
        operation="approval_revoked",
        result=result,
    )
