"""Server-side governance context resolution for Agent OS dry-run decisions.

The client never supplies permissions, kill switches, disabled agents, or approval
state. Workspace membership is resolved through the existing governed PRIMETIME
membership boundary. Until dedicated Agent OS persistence lands, only role-derived
permissions are active; kill switches and disabled-agent overrides resolve to safe
server defaults and remain unavailable as client inputs.
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
    "platform_admin": {
        "agent.plan",
        "agent.read",
        "agent.review",
        "agent.orchestrate",
        "code.generate",
        "code.review",
        "code.test_generate",
    },
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

    # Dedicated persisted Agent OS policy storage is intentionally not invented
    # here. These values remain server-controlled defaults until a governed store
    # is introduced in a separate reviewed migration.
    return ResolvedAgentGovernanceContext(
        workspace_id=str(membership["workspace_id"]),
        actor_id=user_id,
        role=role,
        permissions=permissions,
        approved_actions=set(),
        disabled_agents=set(),
        kill_switch_enabled=False,
    )
