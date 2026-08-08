from __future__ import annotations

from backend.genesis.quality import evaluate_project_state
from backend.genesis.router import router


def test_quality_framework_blocks_incomplete_project() -> None:
    result = evaluate_project_state(
        counts={
            "locked_canon": 0,
            "blocked_tasks": 2,
            "pending_approvals": 1,
            "assets": 0,
            "approved_assets": 0,
            "open_tasks": 4,
        },
        tasks=[],
        providers=[{"configured": False, "manual": True}],
    )
    assert result.release_ready is False
    assert result.status == "failed"
    assert any(finding["category"] == "canon" and finding["blocking"] for finding in result.findings)


def test_quality_framework_passes_complete_governed_project() -> None:
    result = evaluate_project_state(
        counts={
            "locked_canon": 2,
            "blocked_tasks": 0,
            "pending_approvals": 0,
            "assets": 3,
            "approved_assets": 3,
            "open_tasks": 0,
        },
        tasks=[{"status": "completed"}, {"status": "approved"}, {"status": "completed"}],
        providers=[{"configured": True, "manual": False}],
    )
    assert result.release_ready is True
    assert result.status == "passed"
    assert result.overall_score >= 85
    assert not [finding for finding in result.findings if finding["blocking"]]


def test_genesis_router_exposes_vertical_slice_without_global_registration() -> None:
    paths = {route.path for route in router.routes}
    assert "/genesis/health" in paths
    assert "/genesis/projects" in paths
    assert "/genesis/projects/{project_id}/snapshot" in paths
    assert "/genesis/projects/{project_id}/workflows/bootstrap" in paths
    assert "/genesis/projects/{project_id}/render-requests" in paths
    assert "/genesis/projects/{project_id}/evaluate" in paths
    assert "/genesis/projects/{project_id}/evaluations" in paths
    assert "/genesis/approvals/{approval_id}/decide" in paths
