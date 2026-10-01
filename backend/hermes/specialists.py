"""Pinned specialist knowledge; Hermes retains all execution authority.

The pilot ships disabled. Resolving a profile grants no tools, model selection,
child spawning, deployment rights, or permission changes.
"""
from __future__ import annotations

import hashlib
import json
from pathlib import Path
from typing import TYPE_CHECKING

from backend.hermes.contracts import ApprovalMode, SkillManifest, SkillRisk
from backend.hermes.registry import AgentRegistry, BUILTIN_AGENT_REGISTRY
if TYPE_CHECKING:
    from backend.hermes.skills import SkillRegistry

_ROOT = Path(__file__).parent / "vendor" / "wshobson"
_CATALOG = json.loads((_ROOT / "catalog.json").read_text(encoding="utf-8"))
_PROFILES = {item["id"]: item for item in _CATALOG["profiles"]}

SPECIALIST_SKILLS = tuple(
    SkillManifest(
        id=item["id"],
        name=item["name"],
        version="1.0.0",
        description="Pilot specialist knowledge for governed software-factory reviews.",
        capabilities=item["capabilities"],
        required_permissions=["tasks.read", "events.write"],
        allowed_agents=item["allowed_agents"],
        approval_mode=ApprovalMode.POLICY,
        risk=SkillRisk.MEDIUM,
        enabled=False,
        source=f"{_CATALOG['repository']}@{_CATALOG['revision']}",
        metadata={
            "pinned_ref": _CATALOG["revision"],
            "upstream_path": item["upstream_path"],
            "sha256": item["sha256"],
            "license": _CATALOG["license"],
            "status": "pilot_pending",
        },
    )
    for item in _CATALOG["profiles"]
)


def resolve_specialist(
    skill_id: str,
    *,
    agent_id: str,
    skill_registry: SkillRegistry,
    agent_registry: AgentRegistry = BUILTIN_AGENT_REGISTRY,
) -> dict[str, object]:
    """Return verified supplemental knowledge after server-side authorization.

    Registries are trusted server dependencies, never request payloads. Callers
    must persist provenance on the task before handing content to a model and
    continue applying the existing Hermes policy/budget/tool checks.
    """
    agent = agent_registry.get(agent_id)
    if not agent.enabled:
        raise PermissionError(f"agent disabled: {agent_id}")
    skill_registry.authorize(
        skill_id, agent_id=agent.id, agent_permissions=set(agent.permissions)
    )
    try:
        profile = _PROFILES[skill_id]
    except KeyError as exc:
        raise KeyError(f"unknown specialist profile: {skill_id}") from exc
    # Keep the vendor path inside the pinned local bundle, including symlinks.
    path = (_ROOT / profile["path"]).resolve()
    if not path.is_relative_to(_ROOT.resolve()):
        raise ValueError("specialist path escapes vendor bundle")
    data = path.read_bytes()
    if hashlib.sha256(data).hexdigest() != profile["sha256"]:
        raise ValueError(f"specialist integrity check failed: {skill_id}")
    text = data.decode("utf-8")
    # Claude frontmatter is source metadata, not Hermes model/tool authority.
    if not text.startswith("---\n") or "\n---\n" not in text[4:]:
        raise ValueError(f"invalid specialist frontmatter: {skill_id}")
    content = text.split("\n---\n", 1)[1].strip()
    return {
        "authority": "supplemental",
        "content": content,
        "provenance": {
            "skill_id": skill_id,
            "repository": _CATALOG["repository"],
            "revision": _CATALOG["revision"],
            "upstream_path": profile["upstream_path"],
            "sha256": profile["sha256"],
            "license": _CATALOG["license"],
        },
    }
