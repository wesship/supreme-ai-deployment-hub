"""Governed bindings for the capabilities currently exposed by the D3VONN Agent Mesh.

This module does not dispatch work. It maps known mesh capabilities to trusted
ToolDefinition metadata and evaluates dry-run governance decisions before future
runtime integration.
"""
from __future__ import annotations

from pydantic import BaseModel, Field

from .governance import (
    AgentActionRequest,
    AgentGovernanceContext,
    AgentGovernanceResult,
    evaluate_agent_action,
)
from .tool_registry import (
    DataSensitivity,
    SideEffectClass,
    ToolDefinition,
    ToolRegistry,
    governance_fields_for_tool,
)
from .governance import RiskLevel


def create_default_agent_tool_registry() -> ToolRegistry:
    """Return conservative bindings for the capabilities in create_default_mesh()."""
    return ToolRegistry(
        [
            ToolDefinition(
                name="plan",
                description="Create a plan without executing external side effects.",
                required_permissions=["agent.plan"],
                risk_level=RiskLevel.LOW,
                side_effect_class=SideEffectClass.NONE,
                data_sensitivity=DataSensitivity.INTERNAL,
                allowed_agents={"devonn-coordinator"},
            ),
            ToolDefinition(
                name="orchestrate",
                description="Coordinate downstream work; approval required before external execution.",
                required_permissions=["agent.orchestrate"],
                risk_level=RiskLevel.HIGH,
                side_effect_class=SideEffectClass.INTERNAL_WRITE,
                data_sensitivity=DataSensitivity.INTERNAL,
                approval_required=True,
                allowed_agents={"devonn-coordinator"},
            ),
            ToolDefinition(
                name="summarize",
                description="Summarize provided or retrieved information.",
                required_permissions=["agent.read"],
                risk_level=RiskLevel.LOW,
                side_effect_class=SideEffectClass.NONE,
                data_sensitivity=DataSensitivity.INTERNAL,
                allowed_agents={"devonn-coordinator"},
            ),
            ToolDefinition(
                name="review",
                description="Review content or work products without applying changes.",
                required_permissions=["agent.review"],
                risk_level=RiskLevel.MEDIUM,
                side_effect_class=SideEffectClass.NONE,
                data_sensitivity=DataSensitivity.INTERNAL,
                allowed_agents={"devonn-coordinator"},
            ),
            ToolDefinition(
                name="code_generate",
                description="Generate code as a proposed artifact; does not deploy or execute it.",
                required_permissions=["code.generate"],
                risk_level=RiskLevel.MEDIUM,
                side_effect_class=SideEffectClass.NONE,
                data_sensitivity=DataSensitivity.INTERNAL,
                allowed_agents={"openclaw-bridge"},
            ),
            ToolDefinition(
                name="code_review",
                description="Review code without modifying repositories or deployments.",
                required_permissions=["code.review"],
                risk_level=RiskLevel.MEDIUM,
                side_effect_class=SideEffectClass.NONE,
                data_sensitivity=DataSensitivity.INTERNAL,
                allowed_agents={"openclaw-bridge"},
            ),
            ToolDefinition(
                name="test_generate",
                description="Generate test code without executing production actions.",
                required_permissions=["code.test_generate"],
                risk_level=RiskLevel.MEDIUM,
                side_effect_class=SideEffectClass.NONE,
                data_sensitivity=DataSensitivity.INTERNAL,
                allowed_agents={"openclaw-bridge"},
            ),
            ToolDefinition(
                name="quantum.optimize",
                description="Run a bounded optimization experiment and compare it with the classical baseline.",
                required_permissions=["optimization.quantum"],
                risk_level=RiskLevel.MEDIUM,
                side_effect_class=SideEffectClass.NONE,
                data_sensitivity=DataSensitivity.INTERNAL,
                allowed_agents={"devonn-coordinator"},
            ),
            ToolDefinition(
                name="chip.design_space.optimize",
                description="Rank bounded FPGA or ASIC design candidates against explicit engineering constraints.",
                required_permissions=["optimization.chip_design_space"],
                risk_level=RiskLevel.MEDIUM,
                side_effect_class=SideEffectClass.NONE,
                data_sensitivity=DataSensitivity.INTERNAL,
                allowed_agents={"devonn-coordinator"},
            ),
        ]
    )


class AgentDryRunRequest(BaseModel):
    workspace_id: str = Field(min_length=1)
    actor_id: str = Field(min_length=1)
    agent_name: str = Field(min_length=1)
    capability: str = Field(min_length=1)
    workspace_permissions: set[str] = Field(default_factory=set)
    approved_actions: set[str] = Field(default_factory=set)
    disabled_agents: set[str] = Field(default_factory=set)
    kill_switch_enabled: bool = False


class AgentDryRunResult(BaseModel):
    capability: str
    agent_name: str
    governance: AgentGovernanceResult


def evaluate_agent_capability_dry_run(
    request: AgentDryRunRequest,
    registry: ToolRegistry | None = None,
) -> AgentDryRunResult:
    """Evaluate a capability without dispatching or invoking any provider."""
    active_registry = registry or create_default_agent_tool_registry()
    tool = active_registry.require_for_agent(request.capability, request.agent_name)
    trusted = governance_fields_for_tool(tool)

    action_request = AgentActionRequest(
        workspace_id=request.workspace_id,
        actor_id=request.actor_id,
        agent_name=request.agent_name,
        action=request.capability,
        required_permissions=trusted["required_permissions"],
        risk_level=trusted["risk_level"],
        external_side_effect=bool(trusted["external_side_effect"]),
        contains_sensitive_data=bool(trusted["contains_sensitive_data"]),
    )
    context = AgentGovernanceContext(
        workspace_permissions=request.workspace_permissions,
        approved_actions=request.approved_actions,
        disabled_agents=request.disabled_agents,
        kill_switch_enabled=request.kill_switch_enabled,
    )
    return AgentDryRunResult(
        capability=request.capability,
        agent_name=request.agent_name,
        governance=evaluate_agent_action(action_request, context),
    )
