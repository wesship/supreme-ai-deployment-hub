from __future__ import annotations

from dataclasses import dataclass, field
from enum import Enum
from typing import Any
from uuid import uuid4


class CampaignState(str, Enum):
    DRAFT = "draft"
    PLANNING = "planning"
    GENERATING = "generating"
    QA = "qa"
    APPROVAL = "approval"
    READY_TO_PUBLISH = "ready_to_publish"
    SCHEDULED = "scheduled"
    PUBLISHED = "published"
    MEASURING = "measuring"
    OPTIMIZING = "optimizing"
    COMPLETED = "completed"
    PAUSED_APPROVAL = "paused_approval"
    FAILED = "failed"


_ALLOWED_TRANSITIONS: dict[CampaignState, set[CampaignState]] = {
    CampaignState.DRAFT: {CampaignState.PLANNING, CampaignState.FAILED},
    CampaignState.PLANNING: {CampaignState.GENERATING, CampaignState.FAILED},
    CampaignState.GENERATING: {CampaignState.QA, CampaignState.FAILED},
    CampaignState.QA: {CampaignState.APPROVAL, CampaignState.GENERATING, CampaignState.FAILED},
    CampaignState.APPROVAL: {CampaignState.READY_TO_PUBLISH, CampaignState.PAUSED_APPROVAL, CampaignState.FAILED},
    CampaignState.PAUSED_APPROVAL: {CampaignState.APPROVAL, CampaignState.FAILED},
    CampaignState.READY_TO_PUBLISH: {CampaignState.SCHEDULED, CampaignState.FAILED},
    CampaignState.SCHEDULED: {CampaignState.PUBLISHED, CampaignState.FAILED},
    CampaignState.PUBLISHED: {CampaignState.MEASURING, CampaignState.FAILED},
    CampaignState.MEASURING: {CampaignState.OPTIMIZING, CampaignState.COMPLETED, CampaignState.FAILED},
    CampaignState.OPTIMIZING: {CampaignState.GENERATING, CampaignState.COMPLETED, CampaignState.FAILED},
    CampaignState.COMPLETED: set(),
    CampaignState.FAILED: set(),
}


@dataclass(slots=True)
class Persona:
    display_name: str
    character_bible: str
    niche: str
    persona_id: str = field(default_factory=lambda: str(uuid4()))
    synthetic_disclosure: bool = True
    declared_age: int = 21
    appearance_spec: dict[str, Any] = field(default_factory=dict)
    voice_spec: dict[str, Any] = field(default_factory=dict)
    reference_assets: list[str] = field(default_factory=list)
    allowed_content: list[str] = field(default_factory=list)
    forbidden_content: list[str] = field(default_factory=list)
    provenance: dict[str, Any] = field(default_factory=dict)

    def __post_init__(self) -> None:
        if self.declared_age < 21:
            raise ValueError("Influencer Studio personas must be declared age 21 or older")
        if not self.synthetic_disclosure:
            raise ValueError("Synthetic persona disclosure is required")


@dataclass(slots=True)
class Campaign:
    persona_id: str
    objective: str
    campaign_id: str = field(default_factory=lambda: str(uuid4()))
    state: CampaignState = CampaignState.DRAFT
    metadata: dict[str, Any] = field(default_factory=dict)
    hermes_goal_id: str | None = None
    hermes_task_id: str | None = None

    def transition(self, target: CampaignState) -> None:
        if target not in _ALLOWED_TRANSITIONS[self.state]:
            raise ValueError(f"Invalid campaign transition: {self.state.value} -> {target.value}")
        self.state = target
