"""Static capability policy for PRIMETIME agent dispatch.

This is deliberately deny-by-default. Adding a capability requires a code
review because it may grant data access or introduce side effects.
"""
from __future__ import annotations

from dataclasses import dataclass


@dataclass(frozen=True)
class Capability:
    name: str
    allowed_agents: frozenset[str]
    side_effect: bool
    human_approval_required: bool
    data_scopes: frozenset[str]


CAPABILITIES: dict[str, Capability] = {
    "score_lead": Capability("score_lead", frozenset({"primetime-scorer"}), False, False, frozenset({"lead", "interaction"})),
    "research": Capability("research", frozenset({"primetime-researcher"}), False, False, frozenset({"lead", "interaction", "approved_research_sources"})),
    "retrieve_context": Capability("retrieve_context", frozenset({"primetime-researcher", "primetime-writer"}), False, False, frozenset({"approved_context"})),
    "draft_outreach": Capability("draft_outreach", frozenset({"primetime-writer"}), True, True, frozenset({"lead", "interaction", "research"})),
    "generate_asset": Capability("generate_asset", frozenset({"primetime-creative"}), True, True, frozenset({"lead", "research"})),
}


def authorize_capability(*, agent: str, capability: str) -> Capability:
    policy = CAPABILITIES.get(capability)
    if policy is None or agent not in policy.allowed_agents:
        raise PermissionError(f"agent {agent!r} is not authorized for capability {capability!r}")
    return policy
