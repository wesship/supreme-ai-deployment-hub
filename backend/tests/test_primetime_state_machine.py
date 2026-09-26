import pytest

from backend.app.routers.primetime_state_machine import WorkflowState, validate_transition


def test_normal_transition_is_allowed():
    transition = validate_transition(WorkflowState.RECEIVED, WorkflowState.VALIDATED, actor_type="system")
    assert transition.to_state == WorkflowState.VALIDATED


def test_invalid_transition_is_denied():
    with pytest.raises(ValueError):
        validate_transition(WorkflowState.RECEIVED, WorkflowState.ENGAGED, actor_type="system")


def test_approval_cannot_be_granted_by_agent():
    with pytest.raises(PermissionError):
        validate_transition(WorkflowState.READY_FOR_REVIEW, WorkflowState.APPROVED, actor_type="agent")


def test_approval_requires_human():
    transition = validate_transition(WorkflowState.READY_FOR_REVIEW, WorkflowState.APPROVED, actor_type="user")
    assert transition.actor_type == "user"
