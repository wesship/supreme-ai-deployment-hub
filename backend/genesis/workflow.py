"""Deterministic workflow and task state rules for Genesis."""
from __future__ import annotations

from dataclasses import dataclass
from typing import Any


TASK_TRANSITIONS: dict[str, frozenset[str]] = {
    "backlog": frozenset({"ready", "cancelled"}),
    "ready": frozenset({"claimed", "in_progress", "blocked", "cancelled"}),
    "claimed": frozenset({"in_progress", "ready", "blocked", "cancelled", "failed"}),
    "in_progress": frozenset({"waiting", "blocked", "review", "completed", "failed", "cancelled"}),
    "waiting": frozenset({"in_progress", "blocked", "cancelled", "failed"}),
    "blocked": frozenset({"ready", "in_progress", "cancelled", "failed"}),
    "review": frozenset({"revision", "approved", "completed", "failed"}),
    "revision": frozenset({"ready", "in_progress", "cancelled"}),
    "approved": frozenset({"completed"}),
    "completed": frozenset(),
    "cancelled": frozenset(),
    "failed": frozenset({"ready", "cancelled"}),
}

WORKFLOW_TRANSITIONS: dict[str, frozenset[str]] = {
    "draft": frozenset({"pending", "cancelled"}),
    "pending": frozenset({"scheduled", "cancelled", "failed"}),
    "scheduled": frozenset({"running", "cancelled", "failed"}),
    "running": frozenset({"waiting", "paused", "blocked", "cancelling", "failed", "completed", "completed_with_warnings"}),
    "waiting": frozenset({"running", "paused", "blocked", "cancelling", "failed"}),
    "paused": frozenset({"running", "cancelling", "cancelled"}),
    "blocked": frozenset({"running", "paused", "cancelling", "failed"}),
    "cancelling": frozenset({"cancelled", "failed"}),
    "cancelled": frozenset(),
    "failed": frozenset({"scheduled", "cancelled"}),
    "completed": frozenset(),
    "completed_with_warnings": frozenset(),
}


class InvalidTransition(ValueError):
    pass


def validate_transition(current: str, target: str, transitions: dict[str, frozenset[str]]) -> None:
    if current not in transitions:
        raise InvalidTransition(f"Unknown current state: {current}")
    if target not in transitions[current]:
        raise InvalidTransition(f"Invalid transition: {current} -> {target}")


def validate_task_transition(current: str, target: str) -> None:
    validate_transition(current, target, TASK_TRANSITIONS)


def validate_workflow_transition(current: str, target: str) -> None:
    validate_transition(current, target, WORKFLOW_TRANSITIONS)


@dataclass(frozen=True)
class BootstrapTask:
    key: str
    title: str
    task_type: str
    acceptance_criteria: tuple[str, ...]
    dependencies: tuple[str, ...] = ()
    priority: int = 3


BASE_BOOTSTRAP_TASKS: tuple[BootstrapTask, ...] = (
    BootstrapTask(
        key="canon_foundation",
        title="Lock the project canon foundation",
        task_type="canon",
        acceptance_criteria=(
            "At least one approved or locked canon entry exists",
            "Project identity and non-negotiable constraints are recorded",
        ),
        priority=1,
    ),
    BootstrapTask(
        key="knowledge_map",
        title="Build the initial knowledge graph",
        task_type="knowledge_graph",
        dependencies=("canon_foundation",),
        acceptance_criteria=(
            "Primary characters, locations, systems, or product domains are registered",
            "Critical relationships have confidence and source metadata",
        ),
        priority=2,
    ),
    BootstrapTask(
        key="production_plan",
        title="Create the production execution plan",
        task_type="planning",
        dependencies=("canon_foundation",),
        acceptance_criteria=(
            "Milestones and deliverables are explicit",
            "Blocking dependencies and approval boundaries are identified",
        ),
        priority=2,
    ),
    BootstrapTask(
        key="asset_registry",
        title="Register existing source assets and versions",
        task_type="asset_registry",
        dependencies=("knowledge_map",),
        acceptance_criteria=(
            "Every imported source has a stable identity",
            "Approved assets retain immutable version provenance",
        ),
    ),
    BootstrapTask(
        key="quality_baseline",
        title="Establish verification and quality gates",
        task_type="quality_assurance",
        dependencies=("production_plan",),
        acceptance_criteria=(
            "Canon, technical, security, and accessibility checks are defined",
            "Release-blocking thresholds are explicit",
        ),
    ),
)


def build_bootstrap_tasks(
    *,
    include_render_readiness: bool,
    include_release_readiness: bool,
) -> list[dict[str, Any]]:
    tasks = list(BASE_BOOTSTRAP_TASKS)
    if include_render_readiness:
        tasks.append(
            BootstrapTask(
                key="render_readiness",
                title="Configure render gateway readiness",
                task_type="render_gateway",
                dependencies=("asset_registry", "quality_baseline"),
                acceptance_criteria=(
                    "At least one governed provider route is configured",
                    "Cost, provenance, quarantine, and fallback controls are active",
                ),
            )
        )
    if include_release_readiness:
        dependencies = ("quality_baseline", "render_readiness") if include_render_readiness else ("quality_baseline",)
        tasks.append(
            BootstrapTask(
                key="release_readiness",
                title="Build the release-readiness baseline",
                task_type="release",
                dependencies=dependencies,
                acceptance_criteria=(
                    "Required deliverables and review gates are listed",
                    "Every release item resolves to an exact asset version",
                ),
                priority=4,
            )
        )
    return [
        {
            "key": task.key,
            "title": task.title,
            "task_type": task.task_type,
            "priority": task.priority,
            "acceptance_criteria": list(task.acceptance_criteria),
            "dependencies": list(task.dependencies),
        }
        for task in tasks
    ]


def calculate_progress(steps: list[dict[str, Any]]) -> float:
    if not steps:
        return 0.0
    total_weight = sum(float(step.get("weight", 1) or 1) for step in steps)
    completed_weight = sum(
        float(step.get("weight", 1) or 1)
        for step in steps
        if step.get("status") in {"succeeded", "skipped", "compensated"}
    )
    return round(completed_weight / total_weight, 4) if total_weight else 0.0
