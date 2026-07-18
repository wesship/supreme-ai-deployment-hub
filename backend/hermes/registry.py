"""Manifest-driven built-in Hermes agent registry."""
from __future__ import annotations

from collections.abc import Iterable

from backend.hermes.contracts import AgentManifest, AgentRole, ApprovalMode, ToolContract


class AgentRegistry:
    """In-memory registry with strict duplicate and dependency validation."""

    def __init__(self, manifests: Iterable[AgentManifest] | None = None) -> None:
        self._manifests: dict[str, AgentManifest] = {}
        for manifest in manifests or ():
            self.register(manifest)
        self.validate_relationships()

    def register(self, manifest: AgentManifest, *, replace: bool = False) -> None:
        if manifest.id in self._manifests and not replace:
            raise ValueError(f"agent already registered: {manifest.id}")
        self._manifests[manifest.id] = manifest

    def get(self, agent_id: str) -> AgentManifest:
        try:
            return self._manifests[agent_id]
        except KeyError as exc:
            raise KeyError(f"unknown agent: {agent_id}") from exc

    def list(self, *, enabled_only: bool = True) -> list[AgentManifest]:
        manifests = self._manifests.values()
        if enabled_only:
            manifests = (manifest for manifest in manifests if manifest.enabled)
        return sorted(manifests, key=lambda manifest: manifest.id)

    def validate_relationships(self) -> None:
        known = set(self._manifests)
        missing: list[str] = []
        for manifest in self._manifests.values():
            for child in manifest.children:
                if child not in known:
                    missing.append(f"{manifest.id}->{child}")
        if missing:
            raise ValueError(f"unknown child agent references: {', '.join(sorted(missing))}")

    def hierarchy(self) -> dict[str, dict[str, object]]:
        return {
            manifest.id.upper(): {
                "role": manifest.role.value,
                "children": [child.upper() for child in manifest.children],
            }
            for manifest in self.list(enabled_only=False)
        }


BUILTIN_MANIFESTS = (
    AgentManifest(
        id="hermes",
        name="HERMES",
        version="1.0.0",
        role=AgentRole.ORCHESTRATOR,
        description="Canonical D3VONN.IO orchestration and policy-routing agent.",
        capabilities=[
            "workflow.plan",
            "workflow.dispatch",
            "workflow.checkpoint",
            "workflow.resume",
            "approval.request",
        ],
        permissions=["tasks.read", "tasks.write", "events.write", "agents.dispatch"],
        tools=[
            ToolContract(
                name="agent-dispatch",
                permissions=["agents.dispatch"],
                approval_mode=ApprovalMode.POLICY,
            )
        ],
        children=["tars", "ion", "sapphire", "guardian"],
    ),
    AgentManifest(
        id="tars",
        name="TARS",
        version="1.0.0",
        role=AgentRole.EXECUTION,
        description="Execution agent for plans, summaries, follow-up, and research tasks.",
        capabilities=["task.execute", "tool.invoke"],
        permissions=["tasks.read", "tasks.transition", "tools.invoke"],
    ),
    AgentManifest(
        id="ion",
        name="ION",
        version="1.0.0",
        role=AgentRole.ANALYTICS,
        description="Analytics and evaluation agent.",
        capabilities=["analysis.compute", "evaluation.score"],
        permissions=["tasks.read", "events.write"],
    ),
    AgentManifest(
        id="sapphire",
        name="SAPPHIRE",
        version="1.0.0",
        role=AgentRole.MEMORY,
        description="Memory, retrieval, and knowledge-context agent.",
        capabilities=["memory.read", "memory.write", "context.retrieve"],
        permissions=["memory.read", "memory.write", "events.write"],
    ),
    AgentManifest(
        id="guardian",
        name="GUARDIAN",
        version="1.0.0",
        role=AgentRole.SAFETY,
        description="Safety, policy, and destructive-action approval agent.",
        capabilities=["policy.evaluate", "approval.enforce", "risk.classify"],
        permissions=["tasks.read", "interrupts.write", "events.write"],
    ),
)

BUILTIN_AGENT_REGISTRY = AgentRegistry(BUILTIN_MANIFESTS)
