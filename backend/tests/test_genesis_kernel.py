from __future__ import annotations

import pytest

from backend.genesis.permissions import (
    APPROVAL_DECISION_ROLES,
    CANON_LOCK_ROLES,
    EVALUATION_ROLES,
    PLANNING_ROLES,
    RENDER_REQUEST_ROLES,
    TASK_MUTATION_ROLES,
)
from backend.genesis.render_gateway import estimate_cost, select_route
from backend.genesis.workflow import (
    InvalidTransition,
    build_bootstrap_tasks,
    calculate_progress,
    validate_task_transition,
)


def test_task_state_machine_accepts_governed_progression() -> None:
    validate_task_transition("ready", "in_progress")
    validate_task_transition("in_progress", "review")
    validate_task_transition("review", "approved")
    validate_task_transition("approved", "completed")


def test_task_state_machine_rejects_approval_bypass() -> None:
    with pytest.raises(InvalidTransition):
        validate_task_transition("backlog", "approved")


def test_bootstrap_workflow_has_dependency_safe_release_path() -> None:
    tasks = build_bootstrap_tasks(include_render_readiness=True, include_release_readiness=True)
    by_key = {task["key"]: task for task in tasks}
    assert by_key["canon_foundation"]["dependencies"] == []
    assert "canon_foundation" in by_key["knowledge_map"]["dependencies"]
    assert "render_readiness" in by_key["release_readiness"]["dependencies"]
    assert all(task["acceptance_criteria"] for task in tasks)


def test_weighted_progress_counts_only_terminal_success_states() -> None:
    progress = calculate_progress([
        {"status": "succeeded", "weight": 2},
        {"status": "running", "weight": 6},
        {"status": "skipped", "weight": 2},
    ])
    assert progress == 0.4


def test_viewer_cannot_perform_governed_mutations() -> None:
    governed_role_sets = (
        CANON_LOCK_ROLES,
        PLANNING_ROLES,
        TASK_MUTATION_ROLES,
        RENDER_REQUEST_ROLES,
        APPROVAL_DECISION_ROLES,
        EVALUATION_ROLES,
    )
    assert all("viewer" not in roles for roles in governed_role_sets)
    assert "owner" in APPROVAL_DECISION_ROLES
    assert "executive_producer" in APPROVAL_DECISION_ROLES


def test_render_gateway_falls_back_to_manual_route_without_credentials(monkeypatch: pytest.MonkeyPatch) -> None:
    for key in (
        "OPENAI_API_KEY",
        "GENESIS_VIDEO_API_KEY",
        "RUNWAY_API_KEY",
        "ELEVENLABS_API_KEY",
        "GENESIS_LOCAL_WORKER_URL",
    ):
        monkeypatch.delenv(key, raising=False)
    route = select_route("video", "image_to_video", "canon_critical")
    assert route.provider == "manual_gateway"
    assert route.manual is True


def test_video_estimate_is_bounded_and_explains_assumptions(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.delenv("GENESIS_VIDEO_API_KEY", raising=False)
    monkeypatch.delenv("RUNWAY_API_KEY", raising=False)
    estimate = estimate_cost(
        domain="video",
        operation="image_to_video",
        normalized_request={"duration_seconds": 8, "output_count": 2, "resolution": "1920x804"},
        routing_profile="canon_critical",
        maximum_cost_usd=25,
    )
    assert estimate.minimum_cost_usd <= estimate.estimated_cost_usd <= estimate.maximum_cost_usd
    assert any("duration=8s" in item for item in estimate.assumptions)
