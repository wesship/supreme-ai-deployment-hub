"""Server-side governance context resolution for Agent OS decisions.

Clients never supply permissions, kill switches, disabled agents, or approval state.
Workspace membership and role are resolved through the existing governed PRIMETIME
membership boundary. Until dedicated Agent OS persistence lands, policy overrides
remain conservative server-side defaults.
"""
from __future__ import annotations

from dataclasses import dataclass

from backend.app.routers.primetime_release1 import _membership_required


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
    *, workspace_id: str, user_id: str
) -> ResolvedAgentGovernanceContext:
    """Resolve trusted governance context for one authenticated workspace member."""
    membership = await _membership_required(workspace_id, user_id)
    role = str(membership.get("role") or "representative")
    permissions = set(_ROLE_PERMISSIONS.get(role, set()))

    return ResolvedAgentGovernanceContext(
        workspace_id=str(membership["workspace_id"]),
        actor_id=user_id,
        role=role,
        permissions=permissions,
        approved_actions=set(),
        disabled_agents=set(),
        kill_switch_enabled=False,
    )
