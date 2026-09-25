from backend.hnf.registry import PERSONAS, WORKFLOWS, get_workflow, list_capabilities


def test_hnf_workflows_are_namespaced_and_unique():
    assert WORKFLOWS
    assert all(name.startswith("hnf.") for name in WORKFLOWS)
    assert len(WORKFLOWS) == len(set(WORKFLOWS))


def test_high_impact_hnf_workflows_require_approval():
    assert get_workflow("hnf.radio.broadcast.publish").requires_approval is True
    assert get_workflow("hnf.support.escalate").requires_approval is True
    assert get_workflow("hnf.admin.operation").requires_approval is True


def test_persona_registry_is_scalable_and_unique():
    assert "hnf-dj-001" in PERSONAS
    assert "hnf-teacher-001" in PERSONAS
    assert len(PERSONAS) == len(set(PERSONAS))


def test_capabilities_shape():
    capabilities = list_capabilities()
    assert capabilities["workflows"]
    assert capabilities["personas"]
    assert {"name", "surface", "description", "requires_approval", "default_priority"} <= set(capabilities["workflows"][0])
