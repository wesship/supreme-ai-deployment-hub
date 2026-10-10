"""Server-side governance context resolution for Agent OS decisions.

Clients never supply permissions, kill switches, disabled agents, or approval state.
Workspace membership and role are resolved through the existing governed PRIMETIME
membership boundary, while Agent OS policy overrides and approval evidence are
resolved through the backend-only persistence adapter.
"""
from __future__ import annotations

from dataclasses import dataclass

from backend.app.routers.primetime_release1 import _membership_required
from .policy_store import resolve_active_approvals, resolve_workspace_policy


_ROLE_PERMISSIONS: dict[str, set[str]] = {
    "trainee": {"agent.read"},
    "representative": {"agent.plan", "agent.read", "agent.review"},
    "trainer": {"agent.plan", "agent.read", "agent.review"},
    "manager": {
        "agent.plan",
        "agent.read",
        "agent.review",
        "agent.orchestrate",
        "code.generate",
        "code.review",
        "code.test_generate",
    },
    "compliance_reviewer": {"agent.read", "agent.review", "code.review"},
    "workspace_admin": {
        "agent.plan",
        "agent.read",
        "agent.review",
        "agent.orchestrate",
        "code.generate",
        "code.review",
        "code.test_generate",
    },
    # platform_admin is intentionally not granted workspace Agent OS capabilities.
    # Its canonical PRIMETIME role is platform/infrastructure administration only.
    "platform_admin": set(),
    "auditor": {"agent.read", "agent.review"},
}


@dataclass(frozen=True)
class ResolvedAgentGovernanceContext:
    workspace_id: str
    actor_id: str
    role: str
    permissions: set[str]
    approved_actions: set[str]
    disabled_agents: set[str]
    kill_switch_enabled: bool


async def resolve_agent_governance_context(
    *, workspace_id: str, user_id: str, agent_name: str
) -> ResolvedAgentGovernanceContext:
    """Resolve trusted governance context for one authenticated workspace member."""
    membership = await _membership_required(workspace_id, user_id)
    role = str(membership.get("role") or "representative")
    permissions = set(_ROLE_PERMISSIONS.get(role, set()))
    canonical_workspace_id = str(membership["workspace_id"])

    kill_switch_enabled, disabled_agents = await resolve_workspace_policy(
        canonical_workspace_id
    )
    approved_actions = await resolve_active_approvals(
        canonical_workspace_id,
        agent_name,
    )

    return ResolvedAgentGovernanceContext(
        workspace_id=canonical_workspace_id,
        actor_id=user_id,
        role=role,
        permissions=permissions,
        approved_actions=approved_actions,
        disabled_agents=disabled_agents,
        kill_switch_enabled=kill_switch_enabled,
    )
