"""Authenticated admin API for governed security-action approvals."""

from __future__ import annotations

import os
from typing import Any
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field

from backend.app.routers.admin import _require_admin
from backend.app.security.approval_execution import ApprovalExecutionService

router = APIRouter(prefix="/api/security/admin/actions", tags=["security-admin"])


class RejectionRequest(BaseModel):
    reason: str = Field(min_length=1, max_length=1000)


def get_db() -> Any:
    try:
        from supabase import create_client
    except ImportError as exc:
        raise HTTPException(status_code=503, detail="supabase-py not installed") from exc

    url = os.getenv("SUPABASE_URL", "")
    key = os.getenv("SUPABASE_SERVICE_ROLE_KEY", "")
    if not url or not key:
        raise HTTPException(status_code=503, detail="Supabase not configured")
    return create_client(url, key)


def get_approval_service(db: Any = Depends(get_db)) -> ApprovalExecutionService:
    # No provider executors are registered here. This HTTP layer can approve,
    # reject, and request execution, but containment remains fail-closed until
    # an audited executor is explicitly wired in a separate gate.
    return ApprovalExecutionService(db=db, executors={})


def _translate_error(exc: Exception) -> HTTPException:
    if isinstance(exc, LookupError):
        return HTTPException(status_code=404, detail=str(exc))
    if isinstance(exc, ValueError):
        return HTTPException(status_code=409, detail=str(exc))
    if isinstance(exc, RuntimeError):
        return HTTPException(status_code=409, detail=str(exc))
    return HTTPException(status_code=500, detail="Security approval operation failed")


@router.post("/{action_id}/approve")
async def approve_security_action(
    action_id: UUID,
    admin_id: str = Depends(_require_admin),
    service: ApprovalExecutionService = Depends(get_approval_service),
):
    try:
        decision = service.approve(str(action_id), admin_id)
        return {
            "action_id": decision.action_id,
            "status": decision.status,
            "approver_id": decision.approver_id,
        }
    except Exception as exc:
        raise _translate_error(exc) from exc


@router.post("/{action_id}/reject")
async def reject_security_action(
    action_id: UUID,
    payload: RejectionRequest,
    admin_id: str = Depends(_require_admin),
    service: ApprovalExecutionService = Depends(get_approval_service),
):
    try:
        decision = service.reject(str(action_id), admin_id, payload.reason)
        return {
            "action_id": decision.action_id,
            "status": decision.status,
            "approver_id": decision.approver_id,
            "reason": decision.reason,
        }
    except Exception as exc:
        raise _translate_error(exc) from exc


@router.post("/{action_id}/execute")
async def execute_approved_security_action(
    action_id: UUID,
    _: str = Depends(_require_admin),
    service: ApprovalExecutionService = Depends(get_approval_service),
):
    try:
        return await service.execute_approved(str(action_id))
    except Exception as exc:
        raise _translate_error(exc) from exc
