"""PRIMETIME governed intelligence state machine.

CRM pipeline stage is deliberately separate from this workflow state. Agent
code may request transitions only through this policy; terminal outbound
states require human approval and compliance gates elsewhere in the runtime.
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


TRANSITIONS: dict[WorkflowState, frozenset[WorkflowState]] = {
    WorkflowState.RECEIVED: frozenset({WorkflowState.VALIDATED, WorkflowState.FAILED}),
    WorkflowState.VALIDATED: frozenset({WorkflowState.QUEUED, WorkflowState.FAILED}),
    WorkflowState.QUEUED: frozenset({WorkflowState.SCORING, WorkflowState.FAILED}),
    WorkflowState.SCORING: frozenset({WorkflowState.SCORED, WorkflowState.FAILED}),
    WorkflowState.SCORED: frozenset({WorkflowState.RESEARCHING, WorkflowState.FAILED}),
    WorkflowState.RESEARCHING: frozenset({WorkflowState.DRAFTING, WorkflowState.ASSET_GENERATION, WorkflowState.AGGREGATING, WorkflowState.FAILED}),
    WorkflowState.DRAFTING: frozenset({WorkflowState.ASSET_GENERATION, WorkflowState.AGGREGATING, WorkflowState.READY_FOR_REVIEW, WorkflowState.FAILED}),
    WorkflowState.ASSET_GENERATION: frozenset({WorkflowState.AGGREGATING, WorkflowState.READY_FOR_REVIEW, WorkflowState.FAILED}),
    WorkflowState.AGGREGATING: frozenset({WorkflowState.READY_FOR_REVIEW, WorkflowState.FAILED}),
    WorkflowState.READY_FOR_REVIEW: frozenset({WorkflowState.APPROVED, WorkflowState.FAILED}),
    WorkflowState.APPROVED: frozenset({WorkflowState.READY_FOR_ENGAGEMENT}),
    WorkflowState.READY_FOR_ENGAGEMENT: frozenset({WorkflowState.ENGAGED}),
    WorkflowState.ENGAGED: frozenset({WorkflowState.CONVERTED}),
    WorkflowState.CONVERTED: frozenset(),
    WorkflowState.FAILED: frozenset({WorkflowState.RETRYING, WorkflowState.FAILED_PERMANENTLY}),
    WorkflowState.RETRYING: frozenset({WorkflowState.QUEUED, WorkflowState.FAILED_PERMANENTLY}),
    WorkflowState.FAILED_PERMANENTLY: frozenset(),
}


@dataclass(frozen=True)
class TransitionDecision:
    allowed: bool
    requires_human_approval: bool = False


def authorize_transition(current: WorkflowState, target: WorkflowState, *, human_approved: bool = False) -> TransitionDecision:
    if target not in TRANSITIONS.get(current, frozenset()):
        raise ValueError(f"invalid PRIMETIME workflow transition: {current} -> {target}")
    requires_approval = target in {WorkflowState.APPROVED, WorkflowState.READY_FOR_ENGAGEMENT}
    if requires_approval and not human_approved:
        raise PermissionError(f"human approval required for transition to {target}")
    return TransitionDecision(allowed=True, requires_human_approval=requires_approval)
