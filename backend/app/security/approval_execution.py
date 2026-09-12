"""Audited human-approval state machine for security containment actions.

This module does not expose an HTTP route. It provides the fail-closed control
layer used by authenticated admin endpoints and explicitly registered executors.
"""

from __future__ import annotations

import asyncio
from dataclasses import dataclass
from datetime import datetime, timezone
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


class ApprovalExecutionService:
    """Approve/reject queued actions and execute only through registered adapters."""

    def __init__(self, db: Any, executors: dict[str, Executor] | None = None):
        self.db = db
        self.executors = executors or {}

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

        now = datetime.now(timezone.utc).isoformat()
        resp = (
            self.db.table("hermes_security_actions")
            .update({
                "status": "approved",
                "details": {
                    **(action.get("details") or {}),
                    "approval": {"approver_id": approver_id, "approved_at": now},
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

        now = datetime.now(timezone.utc).isoformat()
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

    async def execute_approved(self, action_id: str) -> dict[str, Any]:
        action = self._get_action(action_id)
        if not action:
            raise LookupError("security action not found")
        if action.get("status") != "approved":
            raise ValueError("security action must be approved before execution")

        action_type = action.get("action_type", "")
        executor = self.executors.get(action_type)
        if executor is None:
            return {
                "action_id": action_id,
                "action_type": action_type,
                "status": "not_executed",
                "reason": "No audited executor is registered for this action type.",
            }

        started_at = datetime.now(timezone.utc).isoformat()
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
            result = await executor(claimed_action)
        except asyncio.CancelledError:
            completed_at = datetime.now(timezone.utc).isoformat()
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
            completed_at = datetime.now(timezone.utc).isoformat()
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
        completed_at = datetime.now(timezone.utc).isoformat()

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
