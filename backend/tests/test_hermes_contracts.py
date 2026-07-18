from uuid import uuid4

import pytest
from pydantic import ValidationError

from backend.hermes.contracts import (
    AgentManifest,
    AgentRole,
    HermesEvent,
    TaskStatus,
    TaskTransition,
    can_transition,
)
from backend.hermes.registry import AgentRegistry, BUILTIN_AGENT_REGISTRY


def test_builtin_registry_contains_canonical_agents() -> None:
    assert [manifest.id for manifest in BUILTIN_AGENT_REGISTRY.list()] == [
        "guardian",
        "hermes",
        "ion",
        "sapphire",
        "tars",
    ]
    assert BUILTIN_AGENT_REGISTRY.get("hermes").children == [
        "tars",
        "ion",
        "sapphire",
        "guardian",
    ]


def test_registry_hierarchy_preserves_legacy_shape() -> None:
    hierarchy = BUILTIN_AGENT_REGISTRY.hierarchy()
    assert hierarchy["HERMES"] == {
        "role": "orchestrator",
        "children": ["TARS", "ION", "SAPPHIRE", "GUARDIAN"],
    }


def test_registry_rejects_duplicate_agents() -> None:
    manifest = AgentManifest(id="worker", name="Worker", version="1.0.0", role=AgentRole.EXECUTION)
    registry = AgentRegistry([manifest])
    with pytest.raises(ValueError, match="already registered"):
        registry.register(manifest)


def test_registry_rejects_unknown_child_agent() -> None:
    manifest = AgentManifest(
        id="parent",
        name="Parent",
        version="1.0.0",
        role=AgentRole.ORCHESTRATOR,
        children=["missing"],
    )
    with pytest.raises(ValueError, match="parent->missing"):
        AgentRegistry([manifest])


def test_manifest_forbids_unknown_fields_and_duplicate_permissions() -> None:
    with pytest.raises(ValidationError):
        AgentManifest(
            id="worker",
            name="Worker",
            version="1.0.0",
            role=AgentRole.EXECUTION,
            unknown=True,
        )
    with pytest.raises(ValidationError, match="values must be unique"):
        AgentManifest(
            id="worker",
            name="Worker",
            version="1.0.0",
            role=AgentRole.EXECUTION,
            permissions=["tasks.read", "tasks.read"],
        )


def test_task_transition_contract_accepts_legal_transition() -> None:
    transition = TaskTransition(
        task_id=uuid4(),
        from_status=TaskStatus.PENDING,
        to_status=TaskStatus.LOCKED,
        actor="hermes",
    )
    assert transition.to_status is TaskStatus.LOCKED
    assert can_transition("PENDING", "CANCELLED") is True


def test_task_transition_contract_rejects_terminal_transition() -> None:
    with pytest.raises(ValidationError, match="invalid task transition"):
        TaskTransition(
            task_id=uuid4(),
            from_status=TaskStatus.COMPLETED,
            to_status=TaskStatus.RUNNING,
            actor="hermes",
        )


def test_event_envelope_is_versioned_and_strict() -> None:
    event = HermesEvent(event_type="task.created", source="hermes", payload={"priority": 5})
    assert event.contract_version == "1.0"
    assert event.occurred_at.tzinfo is not None
    assert event.payload == {"priority": 5}

    with pytest.raises(ValidationError):
        HermesEvent(event_type="Task Created", source="hermes")
