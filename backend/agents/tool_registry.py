"""Typed tool registry for D3VONN Agent OS governance.

The registry is metadata-only: it does not execute tools. It centralizes the
risk, permission, approval, side-effect, and data-sensitivity declarations that
Agent OS governance must consult before dispatch.
"""
from __future__ import annotations

from enum import Enum
from typing import Iterable

from pydantic import BaseModel, Field

from .governance import RiskLevel


class SideEffectClass(str, Enum):
    NONE = "none"
    INTERNAL_WRITE = "internal_write"
    EXTERNAL_WRITE = "external_write"
    COMMUNICATION = "communication"
    FINANCIAL = "financial"
    DESTRUCTIVE = "destructive"


class DataSensitivity(str, Enum):
    PUBLIC = "public"
    INTERNAL = "internal"
    CONFIDENTIAL = "confidential"
    RESTRICTED = "restricted"


class ToolDefinition(BaseModel):
    name: str = Field(min_length=1)
    description: str = Field(min_length=1)
    required_permissions: list[str] = Field(default_factory=list)
    risk_level: RiskLevel = RiskLevel.LOW
    side_effect_class: SideEffectClass = SideEffectClass.NONE
    data_sensitivity: DataSensitivity = DataSensitivity.INTERNAL
    approval_required: bool = False
    allowed_agents: set[str] = Field(default_factory=set)
    enabled: bool = True

    @property
    def has_external_side_effect(self) -> bool:
        return self.side_effect_class in {
            SideEffectClass.EXTERNAL_WRITE,
            SideEffectClass.COMMUNICATION,
            SideEffectClass.FINANCIAL,
            SideEffectClass.DESTRUCTIVE,
        }

    @property
    def contains_sensitive_data(self) -> bool:
        return self.data_sensitivity in {
            DataSensitivity.CONFIDENTIAL,
            DataSensitivity.RESTRICTED,
        }


class ToolRegistry:
    def __init__(self, tools: Iterable[ToolDefinition] = ()) -> None:
        self._tools: dict[str, ToolDefinition] = {}
        for tool in tools:
            self.register(tool)

    def register(self, tool: ToolDefinition) -> None:
        if tool.name in self._tools:
            raise ValueError(f"tool '{tool.name}' is already registered")
        self._tools[tool.name] = tool

    def get(self, name: str) -> ToolDefinition | None:
        return self._tools.get(name)

    def require(self, name: str) -> ToolDefinition:
        tool = self.get(name)
        if tool is None:
            raise KeyError(f"unknown tool: {name}")
        if not tool.enabled:
            raise PermissionError(f"tool '{name}' is disabled")
        return tool

    def list_enabled(self) -> list[ToolDefinition]:
        return sorted(
            (tool for tool in self._tools.values() if tool.enabled),
            key=lambda tool: tool.name,
        )

    def require_for_agent(self, name: str, agent_name: str) -> ToolDefinition:
        tool = self.require(name)
        if tool.allowed_agents and agent_name not in tool.allowed_agents:
            raise PermissionError(
                f"agent '{agent_name}' is not allowed to use tool '{name}'"
            )
        return tool


def governance_fields_for_tool(tool: ToolDefinition) -> dict[str, object]:
    """Return the canonical governance inputs derived from trusted tool metadata."""
    return {
        "required_permissions": list(tool.required_permissions),
        "risk_level": tool.risk_level,
        "external_side_effect": tool.has_external_side_effect or tool.approval_required,
        "contains_sensitive_data": tool.contains_sensitive_data,
    }
