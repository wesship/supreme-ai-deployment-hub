"""Deterministic safety policy for autonomous tool execution.

Model output is untrusted intent. This module decides whether a registered tool
may execute automatically, requires approval, or must be denied.
"""

from __future__ import annotations

import json
import re
import time
from dataclasses import dataclass
from enum import StrEnum
from typing import Any, Mapping


class ToolRisk(StrEnum):
    READ = "read"
    WRITE = "write"
    DEPLOY = "deploy"
    DESTRUCTIVE = "destructive"


class ApprovalMode(StrEnum):
    AUTO = "auto"
    APPROVAL_REQUIRED = "approval_required"
    DENY = "deny"


@dataclass(frozen=True, slots=True)
class ToolPolicy:
    risk: ToolRisk


@dataclass(frozen=True, slots=True)
class AgentSafetyConfig:
    max_agents: int = 5
    max_depth: int = 3
    max_tool_calls: int = 10
    max_runtime_seconds: int = 5 * 60


@dataclass(frozen=True, slots=True)
class PolicyDecision:
    mode: ApprovalMode
    reason: str


DEFAULT_AGENT_SAFETY = AgentSafetyConfig()

_DESTRUCTIVE_PATTERN = re.compile(
    r"\b(delete|destroy|drop|truncate|purge|erase|wipe|force[-_ ]?push)\b"
    r"|rotate[-_ ]?(secret|credential)|revoke[-_ ]?(secret|credential|access)",
    re.IGNORECASE,
)
_PRODUCTION_PATTERN = re.compile(
    r"\b(production|prod|live|release|promote)\b",
    re.IGNORECASE,
)
_BEARER_PATTERN = re.compile(r"Bearer\s+[A-Za-z0-9._~+/=-]+", re.IGNORECASE)
_SECRET_PATTERN = re.compile(
    r"\b(api[_-]?key|token|secret|password|authorization)\b"
    r"\s*[:=]\s*['\"]?[^\s,'\"}]+",
    re.IGNORECASE,
)


def evaluate_tool_action(
    tool_name: str,
    args: Mapping[str, Any],
    policies: Mapping[str, ToolPolicy],
) -> PolicyDecision:
    """Evaluate a proposed tool action without trusting model classification."""

    policy = policies.get(tool_name)
    if policy is None:
        return PolicyDecision(
            ApprovalMode.DENY,
            f"Tool is not registered with an explicit safety policy: {tool_name}",
        )

    serialized = json.dumps(args, default=str, sort_keys=True)[:100_000]
    if policy.risk is ToolRisk.DESTRUCTIVE or _DESTRUCTIVE_PATTERN.search(serialized):
        return PolicyDecision(
            ApprovalMode.APPROVAL_REQUIRED,
            "Destructive intent requires explicit approval.",
        )
    if policy.risk is ToolRisk.DEPLOY:
        return PolicyDecision(
            ApprovalMode.APPROVAL_REQUIRED,
            "Deployment actions require explicit approval.",
        )
    if policy.risk is ToolRisk.WRITE and _PRODUCTION_PATTERN.search(serialized):
        return PolicyDecision(
            ApprovalMode.APPROVAL_REQUIRED,
            "Production writes require explicit approval.",
        )
    return PolicyDecision(ApprovalMode.AUTO, "Action is within the bounded allowlist.")


def validate_agent_budget(
    *,
    active_agents: int,
    depth: int,
    tool_calls: int,
    started_at: float,
    config: AgentSafetyConfig = DEFAULT_AGENT_SAFETY,
) -> PolicyDecision:
    """Fail closed when an autonomous run exceeds a deterministic budget."""

    if min(active_agents, depth, tool_calls) < 0:
        return PolicyDecision(ApprovalMode.DENY, "Agent budget values cannot be negative.")
    if active_agents > config.max_agents:
        return PolicyDecision(ApprovalMode.DENY, "Maximum agent count exceeded.")
    if depth > config.max_depth:
        return PolicyDecision(ApprovalMode.DENY, "Maximum agent depth exceeded.")
    if tool_calls > config.max_tool_calls:
        return PolicyDecision(ApprovalMode.DENY, "Maximum tool-call budget exceeded.")
    if time.monotonic() - started_at > config.max_runtime_seconds:
        return PolicyDecision(ApprovalMode.DENY, "Maximum autonomous runtime exceeded.")
    return PolicyDecision(ApprovalMode.AUTO, "Autonomous budget is available.")


def remaining_runtime_seconds(
    started_at: float,
    config: AgentSafetyConfig = DEFAULT_AGENT_SAFETY,
) -> float:
    """Return the positive runtime remaining for timeout enforcement."""

    return max(0.0, config.max_runtime_seconds - (time.monotonic() - started_at))


def redact_sensitive_text(value: str) -> str:
    """Redact common credential forms before returning tool observations."""

    bearer_redacted = _BEARER_PATTERN.sub("Bearer [REDACTED]", value)
    return _SECRET_PATTERN.sub(
        lambda match: f"{match.group(1)}=[REDACTED]",
        bearer_redacted,
    )
