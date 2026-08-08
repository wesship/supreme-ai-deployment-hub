from __future__ import annotations

from pathlib import Path

import pytest

from backend.genesis.permissions import (
    APPROVAL_DECISION_ROLES,
    CANON_LOCK_ROLES,
    EVALUATION_ROLES,
    PLANNING_ROLES,
    RENDER_REQUEST_ROLES,
    TASK_MUTATION_ROLES,
)
from backend.genesis.quality import evaluate_project_state
from backend.genesis.render_gateway import estimate_cost, select_route
from backend.genesis.router import router
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
    for key in ("OPENAI_API_KEY", "GENESIS_VIDEO_API_KEY", "RUNWAY_API_KEY", "ELEVENLABS_API_KEY", "GENESIS_LOCAL_WORKER_URL"):
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


def test_quality_framework_blocks_incomplete_project() -> None:
    result = evaluate_project_state(
        counts={"locked_canon": 0, "blocked_tasks": 2, "pending_approvals": 1, "assets": 0, "approved_assets": 0, "open_tasks": 4},
        tasks=[],
        providers=[{"configured": False, "manual": True}],
    )
    assert result.release_ready is False
    assert result.status == "failed"
    assert any(finding["category"] == "canon" and finding["blocking"] for finding in result.findings)
    assert any(gate["gate_key"] == "workflow_complete" and gate["status"] == "blocked" for gate in result.gates)


def test_quality_framework_blocks_failed_terminal_task() -> None:
    result = evaluate_project_state(
        counts={"locked_canon": 2, "blocked_tasks": 0, "pending_approvals": 0, "assets": 2, "approved_assets": 2, "open_tasks": 0},
        tasks=[{"status": "completed"}, {"status": "completed"}, {"status": "failed"}],
        providers=[{"configured": True, "manual": False}],
    )
    assert result.release_ready is False
    assert result.status == "failed"
    assert any(finding["category"] == "workflow" and finding["blocking"] and finding["evidence"].get("failed_tasks") == 1 for finding in result.findings)
    workflow_gate = next(gate for gate in result.gates if gate["gate_key"] == "workflow_complete")
    assert workflow_gate["status"] == "blocked"
    assert workflow_gate["evidence"]["failed_tasks"] == 1


def test_quality_framework_passes_complete_governed_project() -> None:
    result = evaluate_project_state(
        counts={"locked_canon": 2, "blocked_tasks": 0, "pending_approvals": 0, "assets": 3, "approved_assets": 3, "open_tasks": 0},
        tasks=[{"status": "completed"}, {"status": "approved"}, {"status": "completed"}],
        providers=[{"configured": True, "manual": False}],
    )
    assert result.release_ready is True
    assert result.status == "passed"
    assert result.overall_score >= 85
    assert not [finding for finding in result.findings if finding["blocking"]]


def test_genesis_router_exposes_vertical_slice() -> None:
    paths = {route.path for route in router.routes}
    assert "/genesis/health" in paths
    assert "/genesis/projects" in paths
    assert "/genesis/projects/{project_id}/snapshot" in paths
    assert "/genesis/projects/{project_id}/workflows/bootstrap" in paths
    assert "/genesis/projects/{project_id}/render-requests" in paths
    assert "/genesis/projects/{project_id}/evaluate" in paths
    assert "/genesis/projects/{project_id}/evaluations" in paths
    assert "/genesis/approvals/{approval_id}/decide" in paths


def test_migration_contains_security_and_durability_contracts() -> None:
    root = Path(__file__).resolve().parents[2]
    sql = (root / "supabase" / "migrations" / "20260726000000_genesis_platform_foundation.sql").read_text(encoding="utf-8")
    for fragment in (
        "create table if not exists public.genesis_projects",
        "create table if not exists public.genesis_canon_entries",
        "create table if not exists public.genesis_tasks",
        "create table if not exists public.genesis_event_outbox",
        "create table if not exists public.genesis_render_requests",
        "alter table public.genesis_projects enable row level security",
        "create or replace function public.genesis_claim_task",
        "create or replace function public.genesis_emit_event",
    ):
        assert fragment in sql


def test_quality_migration_contains_evaluation_and_gate_contracts() -> None:
    root = Path(__file__).resolve().parents[2]
    sql = (root / "supabase" / "migrations" / "20260726000400_genesis_quality_framework.sql").read_text(encoding="utf-8")
    assert "create table if not exists public.genesis_evaluation_runs" in sql
    assert "create table if not exists public.genesis_findings" in sql
    assert "create table if not exists public.genesis_release_gates" in sql
    assert "alter table public.genesis_evaluation_runs enable row level security" in sql


def test_atomic_mutation_migration_guards_concurrency_and_audit() -> None:
    root = Path(__file__).resolve().parents[2]
    sql = (root / "supabase" / "migrations" / "20260726000900_genesis_atomic_mutation_rpcs.sql").read_text(encoding="utf-8")
    assert "create or replace function public.genesis_transition_task" in sql
    assert "and status = p_expected_status" in sql
    assert "create or replace function public.genesis_decide_approval" in sql
    assert "and status = 'pending'" in sql
    assert sql.count("perform public.genesis_emit_event") == 2
    assert "grant execute on function public.genesis_transition_task" in sql
    assert "grant execute on function public.genesis_decide_approval" in sql


def test_services_use_role_checks_and_atomic_repository_commands() -> None:
    root = Path(__file__).resolve().parents[2]
    service_source = (root / "backend" / "genesis" / "service.py").read_text(encoding="utf-8")
    quality_source = (root / "backend" / "genesis" / "quality.py").read_text(encoding="utf-8")
    repository_source = (root / "backend" / "genesis" / "repository.py").read_text(encoding="utf-8")
    assert "require_project_role" in service_source
    assert "transition_task_atomic" in service_source
    assert "decide_approval_atomic" in service_source
    assert "EVALUATION_ROLES" in quality_source
    assert "async def get_project_role" in repository_source
