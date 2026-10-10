"""Fail-closed governance contracts for the existing D3VONN Agent Mesh.

This module is intentionally side-effect free. It evaluates whether a proposed
agent action may proceed, requires human approval, or must be denied before the
existing mesh dispatch layer is invoked.
"""
from __future__ import annotations

from enum import Enum
from typing import Iterable

from pydantic import BaseModel, Field


class RiskLevel(str, Enum):
    LOW = "low"
    MEDIUM = "medium"
    HIGH = "high"
    CRITICAL = "critical"


class GovernanceDecision(str, Enum):
    ALLOW = "allow"
    REQUIRE_APPROVAL = "require_approval"
    DENY = "deny"


class AgentActionRequest(BaseModel):
    workspace_id: str = Field(min_length=1)
    actor_id: str = Field(min_length=1)
    agent_name: str = Field(min_length=1)
    action: str = Field(min_length=1)
    required_permissions: list[str] = Field(default_factory=list)
    risk_level: RiskLevel = RiskLevel.LOW
    external_side_effect: bool = False
    contains_sensitive_data: bool = False


class AgentGovernanceContext(BaseModel):
    workspace_permissions: set[str] = Field(default_factory=set)
    approved_actions: set[str] = Field(default_factory=set)
    disabled_agents: set[str] = Field(default_factory=set)
    kill_switch_enabled: bool = False


class AgentGovernanceResult(BaseModel):
    decision: GovernanceDecision
    reason: str
    missing_permissions: list[str] = Field(default_factory=list)


def evaluate_agent_action(
    request: AgentActionRequest,
    context: AgentGovernanceContext,
) -> AgentGovernanceResult:
    """Evaluate one action before mesh dispatch.

    Policy order is intentional: emergency controls and explicit denials win
    before permission or approval checks. Unknown/high-impact behavior therefore
    fails closed instead of being inferred as safe.
    """
    if context.kill_switch_enabled:
        return AgentGovernanceResult(
            decision=GovernanceDecision.DENY,
            reason="workspace agent kill switch is enabled",
        )

    if request.agent_name in context.disabled_agents:
        return AgentGovernanceResult(
            decision=GovernanceDecision.DENY,
            reason="agent is disabled for this workspace",
        )

    required = set(request.required_permissions)
    missing = sorted(required - context.workspace_permissions)
    if missing:
        return AgentGovernanceResult(
            decision=GovernanceDecision.DENY,
            reason="required permissions are missing",
            missing_permissions=missing,
        )

    if request.risk_level is RiskLevel.CRITICAL:
        return AgentGovernanceResult(
            decision=GovernanceDecision.DENY,
            reason="critical-risk actions are not eligible for autonomous dispatch",
        )

    needs_approval = (
        request.risk_level is RiskLevel.HIGH
        or request.external_side_effect
        or request.contains_sensitive_data
    )
    if needs_approval and request.action not in context.approved_actions:
        return AgentGovernanceResult(
            decision=GovernanceDecision.REQUIRE_APPROVAL,
            reason="human approval is required before dispatch",
        )

    return AgentGovernanceResult(
        decision=GovernanceDecision.ALLOW,
        reason="governance checks passed",
    )
