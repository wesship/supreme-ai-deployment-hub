"""Versioned contracts for durable Hermes workflow execution."""

from __future__ import annotations

from enum import StrEnum
from typing import Any

from pydantic import BaseModel, ConfigDict, Field, model_validator


class WorkflowStatus(StrEnum):
    PENDING = "PENDING"
    RUNNING = "RUNNING"
    PAUSED = "PAUSED"
    COMPLETED = "COMPLETED"
    FAILED = "FAILED"
    CANCELLED = "CANCELLED"


class StepStatus(StrEnum):
    PENDING = "PENDING"
    READY = "READY"
    RUNNING = "RUNNING"
    WAITING = "WAITING"
    COMPLETED = "COMPLETED"
    FAILED = "FAILED"
    SKIPPED = "SKIPPED"
    CANCELLED = "CANCELLED"


class RetryPolicy(BaseModel):
    model_config = ConfigDict(extra="forbid", frozen=True)

    max_attempts: int = Field(default=1, ge=1, le=20)
    backoff_seconds: float = Field(default=0.0, ge=0.0, le=86_400.0)
    backoff_multiplier: float = Field(default=2.0, ge=1.0, le=10.0)
    max_backoff_seconds: float = Field(default=86_400.0, ge=0.0, le=604_800.0)
    jitter_ratio: float = Field(default=0.0, ge=0.0, le=1.0)
    retryable_errors: tuple[str, ...] = ()


class WorkflowStepDefinition(BaseModel):
    model_config = ConfigDict(extra="forbid", frozen=True)

    id: str = Field(min_length=1, max_length=128, pattern=r"^[a-zA-Z0-9_.-]+$")
    agent: str = Field(min_length=1, max_length=64)
    depends_on: tuple[str, ...] = ()
    input: dict[str, Any] = Field(default_factory=dict)
    retry: RetryPolicy = Field(default_factory=RetryPolicy)
    requires_approval: bool = False
    timeout_seconds: int | None = Field(default=None, ge=1, le=604_800)


class WorkflowDefinition(BaseModel):
    model_config = ConfigDict(extra="forbid", frozen=True)

    schema_version: str = Field(default="1.0", pattern=r"^1\.\d+$")
    id: str = Field(min_length=1, max_length=128, pattern=r"^[a-zA-Z0-9_.-]+$")
    version: str = Field(default="1.0.0", min_length=1, max_length=32)
    steps: tuple[WorkflowStepDefinition, ...] = Field(min_length=1)
    timeout_seconds: int | None = Field(default=None, ge=1, le=2_592_000)
    metadata: dict[str, Any] = Field(default_factory=dict)

    @model_validator(mode="after")
    def validate_graph(self) -> "WorkflowDefinition":
        step_ids = [step.id for step in self.steps]
        if len(step_ids) != len(set(step_ids)):
            raise ValueError("workflow step ids must be unique")

        known = set(step_ids)
        for step in self.steps:
            unknown = set(step.depends_on) - known
            if unknown:
                raise ValueError(f"step {step.id} depends on unknown steps: {sorted(unknown)}")
            if step.id in step.depends_on:
                raise ValueError(f"step {step.id} cannot depend on itself")

        graph = {step.id: set(step.depends_on) for step in self.steps}
        visiting: set[str] = set()
        visited: set[str] = set()

        def visit(step_id: str) -> None:
            if step_id in visiting:
                raise ValueError("workflow graph contains a cycle")
            if step_id in visited:
                return
            visiting.add(step_id)
            for dependency in graph[step_id]:
                visit(dependency)
            visiting.remove(step_id)
            visited.add(step_id)

        for step_id in step_ids:
            visit(step_id)
        return self


class WorkflowStepState(BaseModel):
    model_config = ConfigDict(extra="forbid")

    step_id: str
    status: StepStatus = StepStatus.PENDING
    attempt: int = Field(default=0, ge=0)
    task_id: str | None = None
    output: dict[str, Any] | None = None
    error: str | None = None
    error_type: str | None = None
    started_at: str | None = None
    completed_at: str | None = None
    next_retry_at: str | None = None
    retry_delay_seconds: float | None = Field(default=None, ge=0.0)
    deadline_at: str | None = None
    dead_letter_ready: bool = False


class WorkflowExecutionSnapshot(BaseModel):
    model_config = ConfigDict(extra="forbid")

    schema_version: str = "1.0"
    execution_id: str
    workflow_id: str
    workflow_version: str
    status: WorkflowStatus = WorkflowStatus.PENDING
    steps: dict[str, WorkflowStepState]
    created_at: str
    updated_at: str
    checkpoint_sequence: int = Field(default=0, ge=0)
    deadline_at: str | None = None
    metadata: dict[str, Any] = Field(default_factory=dict)
