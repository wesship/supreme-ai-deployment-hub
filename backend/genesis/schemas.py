"""Pydantic contracts for the Genesis platform vertical slice."""
from __future__ import annotations

from datetime import date
from typing import Any, Literal
from uuid import UUID

from pydantic import BaseModel, Field, field_validator


ProjectType = Literal["film", "series", "episode", "game", "xr", "commercial", "software", "custom"]
RoutingProfile = Literal["quality_first", "balanced", "cost_controlled", "fast_preview", "canon_critical"]


class CreateProjectRequest(BaseModel):
    title: str = Field(min_length=2, max_length=160)
    project_type: ProjectType = "film"
    description: str | None = Field(default=None, max_length=4000)
    canonical_key: str | None = Field(default=None, max_length=200)
    slug: str | None = Field(default=None, max_length=120)
    target_release_date: date | None = None
    metadata: dict[str, Any] = Field(default_factory=dict)

    @field_validator("title")
    @classmethod
    def title_not_blank(cls, value: str) -> str:
        value = value.strip()
        if not value:
            raise ValueError("title must not be blank")
        return value


class CreateGoalRequest(BaseModel):
    title: str = Field(min_length=2, max_length=200)
    objective: str = Field(min_length=5, max_length=8000)
    priority: int = Field(default=3, ge=1, le=5)
    success_criteria: list[str] = Field(default_factory=list)
    constraints: list[str] = Field(default_factory=list)
    auto_start: bool = True


class CreateCanonEntryRequest(BaseModel):
    title: str = Field(min_length=2, max_length=200)
    canon_type: str = Field(min_length=2, max_length=80)
    content: dict[str, Any]
    authority_level: int = Field(default=1, ge=1, le=5)
    lock: bool = False


class BootstrapWorkflowRequest(BaseModel):
    goal_title: str = "Initialize Genesis production foundation"
    include_render_readiness: bool = True
    include_release_readiness: bool = True


class TransitionTaskRequest(BaseModel):
    status: Literal[
        "ready",
        "claimed",
        "in_progress",
        "waiting",
        "blocked",
        "review",
        "revision",
        "approved",
        "completed",
        "cancelled",
        "failed",
    ]
    output: dict[str, Any] | None = None
    reason: str | None = Field(default=None, max_length=2000)


class CreateRenderRequest(BaseModel):
    domain: Literal["text", "image", "video", "audio", "three_d", "postproduction"]
    operation: str = Field(min_length=2, max_length=100)
    objective: str = Field(min_length=5, max_length=8000)
    routing_profile: RoutingProfile = "balanced"
    normalized_request: dict[str, Any] = Field(default_factory=dict)
    maximum_cost_usd: float | None = Field(default=None, ge=0)
    idempotency_key: str = Field(min_length=4, max_length=200)


class RenderEstimate(BaseModel):
    provider: str
    model: str
    estimated_cost_usd: float
    minimum_cost_usd: float
    maximum_cost_usd: float
    approval_required: bool
    assumptions: list[str]


class ApprovalDecisionRequest(BaseModel):
    decision: Literal["approved", "approved_with_conditions", "rejected"]
    notes: str | None = Field(default=None, max_length=4000)
    conditions: dict[str, Any] = Field(default_factory=dict)


class ProjectResponse(BaseModel):
    id: UUID
    title: str
    canonical_key: str
    slug: str
    project_type: str
    status: str
    description: str | None = None
    target_release_date: date | None = None
    metadata: dict[str, Any] = Field(default_factory=dict)

    model_config = {"extra": "allow"}
