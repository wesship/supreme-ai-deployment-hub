"""PRIMETIME governed workflow state machine.

Transitions are deny-by-default and separate workflow state from CRM stage.
Only explicitly permitted transitions may be persisted by callers.
"""
from __future__ import annotations

from dataclasses import dataclass
from enum import StrEnum


class WorkflowState(StrEnum):
    RECEIVED = "RECEIVED"
    VALIDATED = "VALIDATED"
    QUEUED = "QUEUED"
    SCORING = "SCORING"
    SCORED = "SCORED"
    RESEARCHING = "RESEARCHING"
    DRAFTING = "DRAFTING"
    ASSET_GENERATION = "ASSET_GENERATION"
    AGGREGATING = "AGGREGATING"
    READY_FOR_REVIEW = "READY_FOR_REVIEW"
    APPROVED = "APPROVED"
    READY_FOR_ENGAGEMENT = "READY_FOR_ENGAGEMENT"
    ENGAGED = "ENGAGED"
    CONVERTED = "CONVERTED"
    FAILED = "FAILED"
    RETRYING = "RETRYING"
    FAILED_PERMANENTLY = "FAILED_PERMANENTLY"


ALLOWED_TRANSITIONS: dict[WorkflowState, frozenset[WorkflowState]] = {
    WorkflowState.RECEIVED: frozenset({WorkflowState.VALIDATED, WorkflowState.FAILED}),
    WorkflowState.VALIDATED: frozenset({WorkflowState.QUEUED, WorkflowState.FAILED}),
    WorkflowState.QUEUED: frozenset({WorkflowState.SCORING, WorkflowState.FAILED}),
    WorkflowState.SCORING: frozenset({WorkflowState.SCORED, WorkflowState.FAILED}),
    WorkflowState.SCORED: frozenset({WorkflowState.RESEARCHING, WorkflowState.AGGREGATING, WorkflowState.FAILED}),
    WorkflowState.RESEARCHING: frozenset({WorkflowState.DRAFTING, WorkflowState.ASSET_GENERATION, WorkflowState.AGGREGATING, WorkflowState.FAILED}),
    WorkflowState.DRAFTING: frozenset({WorkflowState.AGGREGATING, WorkflowState.FAILED}),
    WorkflowState.ASSET_GENERATION: frozenset({WorkflowState.AGGREGATING, WorkflowState.FAILED}),
    WorkflowState.AGGREGATING: frozenset({WorkflowState.READY_FOR_REVIEW, WorkflowState.FAILED}),
    WorkflowState.READY_FOR_REVIEW: frozenset({WorkflowState.APPROVED, WorkflowState.FAILED}),
    WorkflowState.APPROVED: frozenset({WorkflowState.READY_FOR_ENGAGEMENT}),
    WorkflowState.READY_FOR_ENGAGEMENT: frozenset({WorkflowState.ENGAGED, WorkflowState.FAILED}),
    WorkflowState.ENGAGED: frozenset({WorkflowState.CONVERTED}),
    WorkflowState.CONVERTED: frozenset(),
    WorkflowState.FAILED: frozenset({WorkflowState.RETRYING, WorkflowState.FAILED_PERMANENTLY}),
    WorkflowState.RETRYING: frozenset({WorkflowState.QUEUED, WorkflowState.SCORING, WorkflowState.RESEARCHING, WorkflowState.FAILED, WorkflowState.FAILED_PERMANENTLY}),
    WorkflowState.FAILED_PERMANENTLY: frozenset(),
}


@dataclass(frozen=True)
class Transition:
    from_state: WorkflowState
    to_state: WorkflowState
    actor_type: str
    reason: str


def validate_transition(from_state: WorkflowState, to_state: WorkflowState, *, actor_type: str) -> Transition:
    if to_state not in ALLOWED_TRANSITIONS.get(from_state, frozenset()):
        raise ValueError(f"invalid PRIMETIME transition: {from_state} -> {to_state}")
    if to_state in {WorkflowState.APPROVED, WorkflowState.READY_FOR_ENGAGEMENT} and actor_type != "user":
        raise PermissionError(f"human approval required for {to_state}")
    return Transition(from_state, to_state, actor_type, reason=f"{from_state}->{to_state}")
