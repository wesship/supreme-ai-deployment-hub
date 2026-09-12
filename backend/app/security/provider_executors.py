"""Audited security containment executor registry.

The first adapter is intentionally dry-run only. It validates that the approved
execution path can be exercised end to end without changing an external system.
Real provider adapters must be added explicitly in later gates.
"""

from __future__ import annotations

import os
from typing import Any

from backend.app.security.action_governance import DESTRUCTIVE_ACTIONS
from backend.app.security.approval_execution import Executor


_DRY_RUN_ENV = "SECURITY_CONTAINMENT_DRY_RUN"


def _dry_run_enabled() -> bool:
    return os.getenv(_DRY_RUN_ENV, "false").strip().lower() == "true"


def _approved_target(action: dict[str, Any], action_type: str) -> Any:
    """Resolve the auditable target from the persisted governed action payload."""
    parameters = action.get("parameters") or {}
    details = action.get("details") or {}

    if action_type == "block_ip":
        return parameters.get("ip") or details.get("ip") or details.get("target")
    if action_type in {"revoke_token", "quarantine_account"}:
        return (
            parameters.get("actor")
            or parameters.get("user_id")
            or details.get("user_id")
            or details.get("target")
        )
    return details.get("target")


async def dry_run_containment_executor(action: dict[str, Any]) -> dict[str, Any]:
    """Return an auditable simulation result without performing containment."""
    action_type = str(action.get("action_type", ""))
    if action_type not in DESTRUCTIVE_ACTIONS:
        return {
            "status": "rejected",
            "provider": "dry_run",
            "reason": "Dry-run containment only accepts governed destructive actions.",
        }

    if not _dry_run_enabled():
        return {
            "status": "not_executed",
            "provider": "dry_run",
            "reason": f"{_DRY_RUN_ENV}=true is required for dry-run containment.",
        }

    return {
        "status": "dry_run",
        "provider": "dry_run",
        "action_type": action_type,
        "target": _approved_target(action, action_type),
        "external_side_effect": False,
        "reason": "Containment simulated only; no external system was modified.",
    }


def build_security_executors() -> dict[str, Executor]:
    """Build the explicit executor registry.

    Dry-run mode is opt-in. No executor is registered at all when it is disabled,
    keeping production execution fail-closed by default.
    """
    if not _dry_run_enabled():
        return {}
    return {action_type: dry_run_containment_executor for action_type in DESTRUCTIVE_ACTIONS}
