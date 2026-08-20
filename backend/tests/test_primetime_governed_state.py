import pytest

from backend.app.routers.primetime_governed_state import WorkflowState, authorize_transition


def test_happy_path_transition():
    decision = authorize_transition(WorkflowState.RECEIVED, WorkflowState.VALIDATED)
    assert decision.allowed is True


def test_invalid_skip_is_rejected():
    with pytest.raises(ValueError):
        authorize_transition(WorkflowState.RECEIVED, WorkflowState.APPROVED)


def test_approval_gate_is_enforced():
    with pytest.raises(PermissionError):
        authorize_transition(WorkflowState.READY_FOR_REVIEW, WorkflowState.APPROVED)
    assert authorize_transition(WorkflowState.READY_FOR_REVIEW, WorkflowState.APPROVED, human_approved=True).allowed


def test_ready_for_engagement_requires_approval():
    with pytest.raises(PermissionError):
        authorize_transition(WorkflowState.APPROVED, WorkflowState.READY_FOR_ENGAGEMENT)
