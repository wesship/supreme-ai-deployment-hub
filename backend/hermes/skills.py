"""Governed Hermes skill registry.

Skills are declarative capabilities selected by Hermes. The registry is fail-closed:
unknown, disabled, agent-incompatible, or under-permissioned skills are rejected
before any underlying tool or plugin is invoked.
"""
from __future__ import annotations

from collections.abc import Iterable

from backend.hermes.contracts import ApprovalMode, SkillManifest, SkillRisk


class SkillRegistry:
    def __init__(self, manifests: Iterable[SkillManifest] | None = None) -> None:
        self._manifests: dict[str, SkillManifest] = {}
        for manifest in manifests or ():
            self.register(manifest)

    def register(self, manifest: SkillManifest, *, replace: bool = False) -> None:
        if manifest.id in self._manifests and not replace:
            raise ValueError(f"skill already registered: {manifest.id}")
        self._manifests[manifest.id] = manifest

    def get(self, skill_id: str) -> SkillManifest:
        try:
            return self._manifests[skill_id]
        except KeyError as exc:
            raise KeyError(f"unknown skill: {skill_id}") from exc

    def list(self, *, enabled_only: bool = True) -> list[SkillManifest]:
        manifests = self._manifests.values()
        if enabled_only:
            manifests = (manifest for manifest in manifests if manifest.enabled)
        return sorted(manifests, key=lambda manifest: manifest.id)

    def authorize(self, skill_id: str, *, agent_id: str, agent_permissions: set[str]) -> SkillManifest:
        manifest = self.get(skill_id)
        if not manifest.enabled:
            raise PermissionError(f"skill disabled: {skill_id}")
        if manifest.allowed_agents and agent_id not in manifest.allowed_agents:
            raise PermissionError(f"agent {agent_id} is not allowed to use skill {skill_id}")
        missing = set(manifest.required_permissions) - agent_permissions
        if missing:
            raise PermissionError(
                f"agent {agent_id} lacks permissions for skill {skill_id}: {', '.join(sorted(missing))}"
            )
        return manifest


BUILTIN_SKILLS = (
    SkillManifest(
        id="superpowers-dev",
        name="Superpowers Development Workflow",
        version="6.4.1",
        description="Plan-first software delivery with worktrees, TDD, debugging, review, and verification gates.",
        capabilities=["workflow.plan", "code.change", "test.run", "review.request"],
        required_permissions=["tasks.read", "tasks.write", "tools.invoke"],
        allowed_agents=["hermes", "tars"],
        approval_mode=ApprovalMode.POLICY,
        risk=SkillRisk.MEDIUM,
        source="https://github.com/obra/superpowers@5bf4e78011075bcfc0dc295f0724994cd123ee71",
        metadata={"plugin": "obra/superpowers", "pinned_ref": "5bf4e78011075bcfc0dc295f0724994cd123ee71"},
    ),
    SkillManifest(
        id="browser-execution",
        name="Governed Browser Execution",
        version="1.0.0",
        description="Browser/computer execution through approved tools with external-write actions approval-gated.",
        capabilities=["browser.read", "browser.navigate", "browser.act"],
        required_permissions=["tools.invoke"],
        allowed_agents=["hermes", "tars"],
        approval_mode=ApprovalMode.POLICY,
        risk=SkillRisk.HIGH,
    ),
    SkillManifest(
        id="knowledge-writeback",
        name="Knowledge Graph Writeback",
        version="1.0.0",
        description="Persist verified goals, decisions, failures, fixes, and learnings into D3VONN memory.",
        capabilities=["memory.read", "memory.write", "knowledge.link"],
        required_permissions=["memory.read", "memory.write"],
        allowed_agents=["hermes", "sapphire"],
        approval_mode=ApprovalMode.NEVER,
        risk=SkillRisk.LOW,
    ),
    SkillManifest(
        id="release-gate",
        name="Release Verification Gate",
        version="1.0.0",
        description="Require tests, security checks, review evidence, and policy approval before staging or production release.",
        capabilities=["test.run", "security.verify", "release.verify"],
        required_permissions=["tasks.read", "events.write"],
        allowed_agents=["hermes", "guardian", "tars"],
        approval_mode=ApprovalMode.ALWAYS,
        risk=SkillRisk.CRITICAL,
    ),
)

BUILTIN_SKILL_REGISTRY = SkillRegistry(BUILTIN_SKILLS)
