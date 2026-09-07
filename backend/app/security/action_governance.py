"""Shared governance policy for D3VONN security response actions.

The policy deliberately separates recommendations from execution. High-impact
containment actions require explicit approval until a real, audited executor is
wired behind an approved control path.
"""

from __future__ import annotations

from dataclasses import dataclass


DESTRUCTIVE_ACTIONS = frozenset({
    "block_ip",
    "disable_account",
    "quarantine_account",
    "revoke_sessions",
    "invalidate_sessions",
    "revoke_token",
    "revoke_jwt",
    "rotate_refresh_token",
})

NON_DESTRUCTIVE_ACTIONS = frozenset({
    "notify_user",
    "notify_admin",
    "notify_repo_owner",
    "alert_soc",
    "create_incident",
    "generate_report",
    "escalate_incident",
})


@dataclass(frozen=True)
class ActionGovernanceDecision:
    action: str
    requires_approval: bool
    executable: bool
    status: str
    reason: str


def classify_security_action(action: str, *, implemented: bool = False) -> ActionGovernanceDecision:
    """Classify a security action without executing it.

    Destructive actions are always approval-gated. Unknown or unimplemented
    actions are never represented as successful execution.
    """
    if action in DESTRUCTIVE_ACTIONS:
        return ActionGovernanceDecision(
            action=action,
            requires_approval=True,
            executable=False,
            status="pending_approval",
            reason="High-impact containment requires explicit approval and an audited executor.",
        )

    if action in NON_DESTRUCTIVE_ACTIONS:
        if implemented:
            return ActionGovernanceDecision(
                action=action,
                requires_approval=False,
                executable=True,
                status="approved_for_execution",
                reason="Non-destructive action has an implemented handler.",
            )
        return ActionGovernanceDecision(
            action=action,
            requires_approval=False,
            executable=False,
            status="not_executed",
            reason="Action is recognized but no real executor is available.",
        )

    return ActionGovernanceDecision(
        action=action,
        requires_approval=False,
        executable=False,
        status="not_executed",
        reason="Unknown action is not executable by default.",
    )
