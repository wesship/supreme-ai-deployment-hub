import pytest

from backend.hermes.contracts import AgentManifest, AgentRole
from backend.hermes.registry import AgentRegistry
from backend.hermes.skills import BUILTIN_SKILL_REGISTRY, SkillRegistry
from backend.hermes.specialists import SPECIALIST_SKILLS, resolve_specialist


def pilot_registry():
    return SkillRegistry([skill.model_copy(update={"enabled": True}) for skill in SPECIALIST_SKILLS])


@pytest.mark.parametrize("skill", SPECIALIST_SKILLS, ids=lambda skill: skill.id)
def test_registered_profiles_are_disabled_in_production(skill):
    assert BUILTIN_SKILL_REGISTRY.get(skill.id).enabled is False
    assert skill.id not in {s.id for s in BUILTIN_SKILL_REGISTRY.list()}
    with pytest.raises(PermissionError, match="disabled"):
        resolve_specialist(skill.id, agent_id="hermes", skill_registry=BUILTIN_SKILL_REGISTRY)


@pytest.mark.parametrize("skill", SPECIALIST_SKILLS, ids=lambda skill: skill.id)
def test_pilot_resolution_retains_provenance_without_harness_authority(skill):
    result = resolve_specialist(skill.id, agent_id="hermes", skill_registry=pilot_registry())
    assert result["authority"] == "supplemental"
    assert result["content"].startswith("You are")
    assert not result["content"].startswith("---")
    assert result["provenance"]["revision"] == "156b7a5e7a8b93642628a339ee4039c925b34c7f"
    assert result["provenance"]["sha256"] == skill.metadata["sha256"]
    assert not {"model", "tools", "permissions", "children"} & result.keys()


def test_agent_scope_is_enforced():
    with pytest.raises(PermissionError, match="not allowed"):
        resolve_specialist("wshobson-security", agent_id="tars", skill_registry=pilot_registry())
    with pytest.raises(KeyError, match="unknown skill"):
        resolve_specialist("unknown", agent_id="hermes", skill_registry=pilot_registry())


@pytest.mark.parametrize("enabled,permissions,error", [
    (False, ["tasks.read", "events.write"], "agent disabled"),
    (True, ["tasks.read"], "lacks permissions"),
])
def test_trusted_agent_registry_supplies_permissions(enabled, permissions, error):
    agents = AgentRegistry([AgentManifest(
        id="hermes", name="Hermes", version="1.0.0", role=AgentRole.ORCHESTRATOR,
        permissions=permissions, enabled=enabled,
    )])
    with pytest.raises(PermissionError, match=error):
        resolve_specialist("wshobson-fastapi", agent_id="hermes",
                           skill_registry=pilot_registry(), agent_registry=agents)


def test_tampered_profile_fails_closed(tmp_path, monkeypatch):
    from backend.hermes import specialists
    profile = specialists._PROFILES["wshobson-fastapi"]
    (tmp_path / profile["path"]).write_text("changed content")
    monkeypatch.setattr(specialists, "_ROOT", tmp_path)
    with pytest.raises(ValueError, match="integrity"):
        resolve_specialist("wshobson-fastapi", agent_id="hermes", skill_registry=pilot_registry())


def test_vendor_path_escape_fails_closed(tmp_path, monkeypatch):
    from backend.hermes import specialists
    outside = tmp_path / "outside.md"
    outside.write_text("outside")
    bundle = tmp_path / "bundle"
    bundle.mkdir()
    profile = specialists._PROFILES["wshobson-fastapi"]
    (bundle / profile["path"]).symlink_to(outside)
    monkeypatch.setattr(specialists, "_ROOT", bundle)
    with pytest.raises(ValueError, match="escapes"):
        resolve_specialist("wshobson-fastapi", agent_id="hermes", skill_registry=pilot_registry())
