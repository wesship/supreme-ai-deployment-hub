"""Authenticated governance control-plane endpoints for Agent OS.

These endpoints mutate only server-side policy and approval evidence. They never
invoke the Agent Mesh or execute a provider action.
"""
from __future__ import annotations

from datetime import datetime, timezone
from typing import Any

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field

from backend.app.middleware.auth import get_current_user_id
from backend.app.routers.primetime_release1 import (
    _audit,
    _membership_required,
    _require_role,
    _validate_uuid,
)
from .policy_store import (
    create_approval,
    resolve_workspace_policy,
    revoke_approval,
    upsert_workspace_policy,
)

router = APIRouter(prefix="/governance/control", tags=["agent-governance-control"])

_POLICY_ADMIN_ROLES = {"workspace_admin"}
_APPROVAL_ROLES = {"compliance_reviewer", "manager", "workspace_admin"}


class WorkspacePolicyUpdate(BaseModel):
    workspace_id: str
    kill_switch_enabled: bool
    disabled_agents: set[str] = Field(default_factory=set, max_length=100)


class ApprovalCreate(BaseModel):
    workspace_id: str
    action: str = Field(min_length=1, max_length=120)
    agent_name: str | None = Field(default=None, max_length=120)
    expires_at: str
    reason: str = Field(min_length=1, max_length=1000)
    metadata: dict[str, Any] = Field(default_factory=dict)


class ApprovalRevoke(BaseModel):
    workspace_id: str
    approval_id: str
    reason: str = Field(min_length=1, max_length=1000)


def _validate_expiry(value: str) -> str:
    try:
        parsed = datetime.fromisoformat(value.replace("Z", "+00:00"))
    except ValueError as exc:
        raise HTTPException(status_code=400, detail="expires_at must be ISO-8601") from exc
    if parsed.tzinfo is None:
        raise HTTPException(status_code=400, detail="expires_at must include timezone")
    if parsed <= datetime.now(timezone.utc):
        raise HTTPException(status_code=400, detail="expires_at must be in the future")
    return parsed.astimezone(timezone.utc).isoformat()


@router.put("/policy")
async def update_workspace_policy(
    body: WorkspacePolicyUpdate,
    user_id: str = Depends(get_current_user_id),
):
    context = await _membership_required(body.workspace_id, user_id)
    _require_role(context, _POLICY_ADMIN_ROLES)

    previous_kill_switch, previous_disabled = await resolve_workspace_policy(body.workspace_id)
    record = await upsert_workspace_policy(
        workspace_id=body.workspace_id,
        kill_switch_enabled=body.kill_switch_enabled,
        disabled_agents=set(body.disabled_agents),
        updated_by=user_id,
    )
    await _audit(
        body.workspace_id,
        user_id,
        "agent_os.policy.updated",
        "agent_os_workspace_policy",
        body.workspace_id,
        {
            "previous": {
                "kill_switch_enabled": previous_kill_switch,
                "disabled_agents": sorted(previous_disabled),
            },
            "next": {
                "kill_switch_enabled": body.kill_switch_enabled,
                "disabled_agents": sorted(body.disabled_agents),
            },
        },
    )
    return {
        "workspace_id": body.workspace_id,
        "kill_switch_enabled": bool(record.get("kill_switch_enabled", body.kill_switch_enabled)),
        "disabled_agents": record.get("disabled_agents", sorted(body.disabled_agents)),
        "executed": False,
    }


@router.post("/approvals")
async def grant_approval(
    body: ApprovalCreate,
    user_id: str = Depends(get_current_user_id),
):
    context = await _membership_required(body.workspace_id, user_id)
    _require_role(context, _APPROVAL_ROLES)
    expires_at = _validate_expiry(body.expires_at)

    approval = await create_approval(
        workspace_id=body.workspace_id,
        action=body.action.strip(),
        agent_name=body.agent_name.strip() if body.agent_name else None,
        approved_by=user_id,
        expires_at=expires_at,
        reason=body.reason.strip(),
        metadata=body.metadata,
    )
    approval_id = str(approval.get("id") or "")
    await _audit(
        body.workspace_id,
        user_id,
        "agent_os.approval.granted",
        "agent_os_approval",
        approval_id or None,
        {
            "action": body.action,
            "agent_name": body.agent_name,
            "expires_at": expires_at,
            "reason": body.reason,
        },
    )
    return {**approval, "executed": False}


@router.post("/approvals/revoke")
async def revoke_existing_approval(
    body: ApprovalRevoke,
    user_id: str = Depends(get_current_user_id),
):
    context = await _membership_required(body.workspace_id, user_id)
    _require_role(context, _APPROVAL_ROLES)
    approval_id = _validate_uuid(body.approval_id, "approval_id")

    approval = await revoke_approval(
        workspace_id=body.workspace_id,
        approval_id=approval_id,
    )
    if approval is None:
        raise HTTPException(status_code=404, detail="Active approval not found")

    await _audit(
        body.workspace_id,
        user_id,
        "agent_os.approval.revoked",
        "agent_os_approval",
        approval_id,
        {"reason": body.reason},
    )
    return {**approval, "executed": False}
