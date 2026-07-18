"""Versioned public contracts for the Hermes orchestration kernel.

These models define stable boundaries for tasks, runs, agents, tools, and
lifecycle events. Runtime and persistence adapters should depend on these
contracts instead of defining duplicate status strings or payload shapes.
"""
from __future__ import annotations

from datetime import datetime, timezone
from enum import Enum
from typing import Any, Self
from uuid import UUID, uuid4

from pydantic import BaseModel, ConfigDict, Field, field_validator, model_validator

CONTRACT_VERSION = "1.0"


class TaskStatus(str, Enum):
    PENDING = "PENDING"
    LOCKED = "LOCKED"
    RUNNING = "RUNNING"
    COMPLETED = "COMPLETED"
    FAILED = "FAILED"
    RETRY = "RETRY"
    MANUAL_REVIEW = "MANUAL_REVIEW"
    ESCALATED = "ESCALATED"
    PAUSED = "PAUSED"
    CANCELLED = "CANCELLED"


class RunStatus(str, Enum):
    PENDING = "PENDING"
    RUNNING = "RUNNING"
    COMPLETED = "COMPLETED"
    FAILED = "FAILED"
    CANCELLED = "CANCELLED"


class AgentRole(str, Enum):
    ORCHESTRATOR = "orchestrator"
    EXECUTION = "execution"
    ANALYTICS = "analytics"
    MEMORY = "memory"
    SAFETY = "safety"
    SPECIALIST = "specialist"


class ApprovalMode(str, Enum):
    NEVER = "never"
    POLICY = "policy"
    ALWAYS = "always"


TASK_TRANSITIONS: dict[TaskStatus, frozenset[TaskStatus]] = {
    TaskStatus.PENDING: frozenset({TaskStatus.LOCKED, TaskStatus.PAUSED, TaskStatus.CANCELLED}),
    TaskStatus.LOCKED: frozenset({TaskStatus.RUNNING, TaskStatus.PENDING, TaskStatus.FAILED, TaskStatus.CANCELLED}),
    TaskStatus.RUNNING: frozenset(
        {
            TaskStatus.COMPLETED,
            TaskStatus.FAILED,
            TaskStatus.PAUSED,
            TaskStatus.ESCALATED,
            TaskStatus.MANUAL_REVIEW,
            TaskStatus.CANCELLED,
        }
    ),
    TaskStatus.FAILED: frozenset({TaskStatus.RETRY, TaskStatus.MANUAL_REVIEW, TaskStatus.ESCALATED}),
    TaskStatus.RETRY: frozenset({TaskStatus.PENDING, TaskStatus.CANCELLED}),
    TaskStatus.PAUSED: frozenset({TaskStatus.PENDING, TaskStatus.RUNNING, TaskStatus.CANCELLED}),
    TaskStatus.MANUAL_REVIEW: frozenset(
        {TaskStatus.PENDING, TaskStatus.ESCALATED, TaskStatus.COMPLETED, TaskStatus.CANCELLED}
    ),
    TaskStatus.ESCALATED: frozenset(
        {TaskStatus.MANUAL_REVIEW, TaskStatus.COMPLETED, TaskStatus.FAILED, TaskStatus.CANCELLED}
    ),
    TaskStatus.COMPLETED: frozenset(),
    TaskStatus.CANCELLED: frozenset(),
}


def can_transition(current: TaskStatus | str, target: TaskStatus | str) -> bool:
    """Return whether a Hermes task transition is legal under contract v1."""
    current_status = TaskStatus(current)
    target_status = TaskStatus(target)
    return target_status in TASK_TRANSITIONS[current_status]


class StrictContract(BaseModel):
    model_config = ConfigDict(extra="forbid")


class ToolContract(StrictContract):
    name: str = Field(..., min_length=1, max_length=100)
    version: str = Field(default="1.0.0", min_length=1, max_length=50)
    permissions: list[str] = Field(default_factory=list)
    timeout_seconds: int = Field(default=30, ge=1, le=3600)
    rate_limit_per_minute: int | None = Field(default=None, ge=1)
    approval_mode: ApprovalMode = ApprovalMode.POLICY
    destructive: bool = False
    input_schema: dict[str, Any] = Field(default_factory=dict)
    output_schema: dict[str, Any] = Field(default_factory=dict)


class AgentManifest(StrictContract):
    contract_version: str = CONTRACT_VERSION
    id: str = Field(..., min_length=2, max_length=64, pattern=r"^[a-z][a-z0-9_-]*$")
    name: str = Field(..., min_length=2, max_length=100)
    version: str = Field(..., min_length=1, max_length=50)
    role: AgentRole
    description: str = Field(default="", max_length=1000)
    capabilities: list[str] = Field(default_factory=list)
    permissions: list[str] = Field(default_factory=list)
    tools: list[ToolContract] = Field(default_factory=list)
    models: list[str] = Field(default_factory=list)
    children: list[str] = Field(default_factory=list)
    enabled: bool = True
    metadata: dict[str, Any] = Field(default_factory=dict)

    @field_validator("capabilities", "permissions", "models", "children")
    @classmethod
    def values_must_be_unique(cls, values: list[str]) -> list[str]:
        if len(values) != len(set(values)):
            raise ValueError("values must be unique")
        return values


class HermesEvent(StrictContract):
    contract_version: str = CONTRACT_VERSION
    event_id: UUID = Field(default_factory=uuid4)
    event_type: str = Field(..., min_length=3, max_length=120, pattern=r"^[a-z][a-z0-9_.-]+$")
    occurred_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    source: str = Field(..., min_length=1, max_length=100)
    correlation_id: str | None = Field(default=None, max_length=128)
    causation_id: str | None = Field(default=None, max_length=128)
    task_id: UUID | None = None
    run_id: UUID | None = None
    agent_id: str | None = Field(default=None, max_length=64)
    payload: dict[str, Any] = Field(default_factory=dict)
    metadata: dict[str, Any] = Field(default_factory=dict)


class TaskTransition(StrictContract):
    task_id: UUID
    from_status: TaskStatus
    to_status: TaskStatus
    reason: str | None = Field(default=None, max_length=1000)
    actor: str = Field(..., min_length=1, max_length=100)
    correlation_id: str | None = Field(default=None, max_length=128)

    @model_validator(mode="after")
    def transition_must_be_legal(self) -> Self:
        if not can_transition(self.from_status, self.to_status):
            raise ValueError(
                f"invalid task transition: {self.from_status.value} -> {self.to_status.value}"
            )
        return self
