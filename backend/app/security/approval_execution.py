"""Audited human-approval state machine for security containment actions.

This module does not expose an HTTP route. It provides the fail-closed control
layer used by authenticated admin endpoints and explicitly registered executors.
"""

from __future__ import annotations

import asyncio
import hashlib
import json
from dataclasses import dataclass
from datetime import datetime, timedelta, timezone
from typing import Any, Awaitable, Callable
from uuid import uuid4

from backend.app.security.action_governance import DESTRUCTIVE_ACTIONS


Executor = Callable[[dict[str, Any]], Awaitable[dict[str, Any]]]


@dataclass(frozen=True)
class ApprovalDecision:
    action_id: str
    status: str
    approver_id: str
    reason: str | None = None


def _utc_now() -> datetime:
    return datetime.now(timezone.utc)


def _parse_timestamp(value: str) -> datetime:
    if not isinstance(value, str):
        raise ValueError("approval timestamp must be a string")
    parsed = datetime.fromisoformat(value.replace("Z", "+00:00"))
    if parsed.tzinfo is None:
        raise ValueError("approval timestamp must include timezone")
    return parsed.astimezone(timezone.utc)


def _approval_payload(action: dict[str, Any]) -> dict[str, Any]:
    """Return only execution-relevant fields used to bind an approval.

    Mutable audit metadata is deliberately excluded so recording approval and
    execution events cannot invalidate an otherwise unchanged approved action.
    """
    details = dict(action.get("details") or {})
    details.pop("approval", None)
    details.pop("execution", None)
    return {
        "action_type": action.get("action_type"),
        "target": action.get("target"),
        "agent_name": action.get("agent_name"),
        "parameters": action.get("parameters"),
        "details": details,
    }


def _payload_hash(action: dict[str, Any]) -> str:
    encoded = json.dumps(
        _approval_payload(action),
        sort_keys=True,
        separators=(",", ":"),
        ensure_ascii=False,
        default=str,
    ).encode("utf-8")
    return hashlib.sha256(encoded).hexdigest()


class ApprovalExecutionService:
    """Approve/reject queued actions and execute only through registered adapters."""

    def __init__(
        self,
        db: Any,
        executors: dict[str, Executor] | None = None,
        *,
        approval_ttl_seconds: int = 900,
    ):
        if approval_ttl_seconds <= 0:
            raise ValueError("approval_ttl_seconds must be positive")
        self.db = db
        self.executors = executors or {}
        self.approval_ttl_seconds = approval_ttl_seconds

    def _get_action(self, action_id: str) -> dict[str, Any] | None:
        resp = (
            self.db.table("hermes_security_actions")
            .select("*")
            .eq("id", action_id)
            .limit(1)
            .execute()
        )
        rows = resp.data or []
        return rows[0] if rows else None

    def approve(self, action_id: str, approver_id: str) -> ApprovalDecision:
        if not approver_id.strip():
            raise ValueError("approver_id is required")
        action = self._get_action(action_id)
        if not action:
            raise LookupError("security action not found")
        if action.get("status") != "pending_approval":
            raise ValueError("security action is not pending approval")

        action_type = action.get("action_type", "")
        if action_type not in DESTRUCTIVE_ACTIONS:
            raise ValueError("only approval-gated containment actions use this path")

        now_dt = _utc_now()
        now = now_dt.isoformat()
        expires_at = (now_dt + timedelta(seconds=self.approval_ttl_seconds)).isoformat()
        approved_payload_hash = _payload_hash(action)
        resp = (
            self.db.table("hermes_security_actions")
            .update({
                "status": "approved",
                "details": {
                    **(action.get("details") or {}),
                    "approval": {
                        "approver_id": approver_id,
                        "approved_at": now,
                        "expires_at": expires_at,
                        "payload_hash": approved_payload_hash,
                    },
                },
            })
            .eq("id", action_id)
            .eq("status", "pending_approval")
            .execute()
        )
        if not (resp.data or []):
            raise RuntimeError("approval state changed concurrently")
        return ApprovalDecision(action_id, "approved", approver_id)

    def reject(self, action_id: str, approver_id: str, reason: str) -> ApprovalDecision:
        if not approver_id.strip():
            raise ValueError("approver_id is required")
        if not reason.strip():
            raise ValueError("rejection reason is required")
        action = self._get_action(action_id)
        if not action:
            raise LookupError("security action not found")
        if action.get("status") != "pending_approval":
            raise ValueError("security action is not pending approval")

        now = _utc_now().isoformat()
        resp = (
            self.db.table("hermes_security_actions")
            .update({
                "status": "rejected",
                "details": {
                    **(action.get("details") or {}),
                    "approval": {
                        "approver_id": approver_id,
                        "rejected_at": now,
                        "reason": reason,
                    },
                },
            })
            .eq("id", action_id)
            .eq("status", "pending_approval")
            .execute()
        )
        if not (resp.data or []):
            raise RuntimeError("approval state changed concurrently")
        return ApprovalDecision(action_id, "rejected", approver_id, reason)

    def _validate_approval(self, action: dict[str, Any]) -> None:
        approval = (action.get("details") or {}).get("approval") or {}
        approved_hash = approval.get("payload_hash")
        expires_at = approval.get("expires_at")
        approver = approval.get("approver_id")
        if not approved_hash or not expires_at or not isinstance(approver, str) or not approver.strip() or not approval.get("approved_at"):
            raise ValueError("security action approval metadata is incomplete")
        if _payload_hash(action) != approved_hash:
            raise ValueError("security action payload changed after approval")
        try:
            expiry = _parse_timestamp(expires_at)
            approved_at = _parse_timestamp(approval["approved_at"])
        except (TypeError, ValueError) as exc:
            raise ValueError("security action approval expiration is invalid") from exc
        now = _utc_now()
        if now >= expiry:
            raise ValueError("security action approval has expired")
        if approved_at > now or expiry <= approved_at:
            raise ValueError("security action approval timeline is invalid")

    async def execute_approved(self, action_id: str) -> dict[str, Any]:
        action = self._get_action(action_id)
        if not action:
            raise LookupError("security action not found")
        if action.get("status") != "approved":
            raise ValueError("security action must be approved before execution")

        self._validate_approval(action)

        action_type = action.get("action_type", "")
        executor = self.executors.get(action_type)
        if executor is None:
            return {
                "action_id": action_id,
                "action_type": action_type,
                "status": "not_executed",
                "reason": "No audited executor is registered for this action type.",
            }

        started_at = _utc_now().isoformat()
        execution_id = str(uuid4())
        claim = (
            self.db.table("hermes_security_actions")
            .update({
                "status": "executing",
                "details": {
                    **(action.get("details") or {}),
                    "execution": {
                        "execution_id": execution_id,
                        "started_at": started_at,
                        "approved_payload_hash": ((action.get("details") or {}).get("approval") or {}).get("payload_hash"),
                    },
                },
            })
            .eq("id", action_id)
            .eq("status", "approved")
            .execute()
        )
        claimed_rows = claim.data or []
        if not claimed_rows:
            raise RuntimeError("execution state changed concurrently")

        claimed_action = claimed_rows[0]
        try:
            # Recheck the returned claim: a concurrent payload update or expiry
            # between the first read and the atomic status claim must not execute.
            self._validate_approval(claimed_action)
            result = await executor(claimed_action)
        except asyncio.CancelledError:
            completed_at = _utc_now().isoformat()
            self.db.table("hermes_security_actions").update({
                "status": "execution_failed",
                "details": {
                    **(claimed_action.get("details") or {}),
                    "execution": {
                        **((claimed_action.get("details") or {}).get("execution") or {}),
                        "completed_at": completed_at,
                        "error": "Executor was cancelled before returning a result.",
                    },
                },
            }).eq("id", action_id).eq("status", "executing").execute()
            raise
        except Exception as exc:
            completed_at = _utc_now().isoformat()
            self.db.table("hermes_security_actions").update({
                "status": "execution_failed",
                "details": {
                    **(claimed_action.get("details") or {}),
                    "execution": {
                        **((claimed_action.get("details") or {}).get("execution") or {}),
                        "completed_at": completed_at,
                        "error": "Executor failed before returning a result.",
                    },
                },
            }).eq("id", action_id).eq("status", "executing").execute()
            raise RuntimeError("security action executor failed") from exc

        result_status = result.get("status")
        if result_status == "success":
            final_status = "executed"
        elif result_status == "dry_run":
            final_status = "dry_run"
        else:
            final_status = "execution_failed"
        completed_at = _utc_now().isoformat()

        update = {
            "status": final_status,
            "details": {
                **(claimed_action.get("details") or {}),
                "execution": {
                    **((claimed_action.get("details") or {}).get("execution") or {}),
                    "started_at": started_at,
                    "completed_at": completed_at,
                    "result": result,
                },
            },
        }
        resp = (
            self.db.table("hermes_security_actions")
            .update(update)
            .eq("id", action_id)
            .eq("status", "executing")
            .execute()
        )
        if not (resp.data or []):
            raise RuntimeError("execution state changed concurrently")

        return {
            "action_id": action_id,
            "action_type": action_type,
            "status": final_status,
            "result": result,
        }
