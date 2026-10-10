"""Deterministic Genesis quality and release-readiness evaluation."""
from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime, timezone
from typing import Any
from uuid import UUID

from .permissions import EVALUATION_ROLES
from .render_gateway import public_provider_health
from .repository import GenesisRepository, repository


@dataclass(frozen=True)
class QualityResult:
    scores: dict[str, float]
    overall_score: float
    release_ready: bool
    status: str
    summary: str
    findings: list[dict[str, Any]]
    gates: list[dict[str, Any]]


def _clamp(value: float) -> float:
    return round(max(0.0, min(100.0, value)), 2)


def evaluate_project_state(
    *,
    counts: dict[str, int],
    tasks: list[dict[str, Any]],
    providers: list[dict[str, Any]],
    failed_render_count: int = 0,
) -> QualityResult:
    total_tasks = len(tasks)
    completed_tasks = sum(1 for task in tasks if task.get("status") in {"approved", "completed"})
    failed_tasks = sum(1 for task in tasks if task.get("status") == "failed")
    workflow_score = _clamp((completed_tasks / total_tasks) * 100 if total_tasks else 25)
    canon_score = 100.0 if counts.get("locked_canon", 0) > 0 else 20.0
    blocked_tasks = counts.get("blocked_tasks", 0)
    continuity_score = _clamp(100 - blocked_tasks * 25 - failed_tasks * 35)
    pending_approvals = counts.get("pending_approvals", 0)
    governance_score = _clamp(100 - pending_approvals * 15)
    assets = counts.get("assets", 0)
    approved_assets = counts.get("approved_assets", 0)
    asset_score = _clamp((approved_assets / assets) * 100 if assets else 30)
    automated_provider_ready = any(provider.get("configured") and not provider.get("manual") for provider in providers)
    technical_score = 100.0 if automated_provider_ready else 70.0
    if failed_render_count:
        technical_score = _clamp(technical_score - failed_render_count * 15)
    release_score = _clamp(
        workflow_score * 0.30
        + asset_score * 0.25
        + governance_score * 0.20
        + canon_score * 0.15
        + technical_score * 0.10
    )
    scores = {
        "canon": canon_score,
        "workflow": workflow_score,
        "continuity": continuity_score,
        "governance": governance_score,
        "assets": asset_score,
        "technical": technical_score,
        "release": release_score,
    }
    overall = _clamp(
        canon_score * 0.15
        + workflow_score * 0.20
        + continuity_score * 0.15
        + governance_score * 0.15
        + asset_score * 0.15
        + technical_score * 0.10
        + release_score * 0.10
    )

    findings: list[dict[str, Any]] = []
    if counts.get("locked_canon", 0) == 0:
        findings.append({
            "severity": "critical",
            "category": "canon",
            "title": "No locked canon foundation",
            "description": "The project can drift because no authority-level canon entry is locked.",
            "remediation": "Approve and lock the project identity and non-negotiable rules.",
            "blocking": True,
            "evidence": {"locked_canon": 0},
        })
    if total_tasks == 0:
        findings.append({
            "severity": "high",
            "category": "workflow",
            "title": "Production workflow has not been bootstrapped",
            "description": "No dependency-aware production tasks are registered.",
            "remediation": "Run the Genesis bootstrap workflow.",
            "blocking": True,
            "evidence": {"task_count": 0},
        })
    if failed_tasks:
        findings.append({
            "severity": "high",
            "category": "workflow",
            "title": f"{failed_tasks} production task(s) failed",
            "description": "Failed terminal tasks are incomplete production work and block release readiness.",
            "remediation": "Retry, replace, or explicitly complete the failed work before release evaluation.",
            "blocking": True,
            "evidence": {"failed_tasks": failed_tasks},
        })
    if blocked_tasks:
        findings.append({
            "severity": "high",
            "category": "continuity",
            "title": f"{blocked_tasks} production task(s) are blocked",
            "description": "Blocked work prevents downstream workflow completion.",
            "remediation": "Resolve missing dependencies or explicitly accept the risk.",
            "blocking": True,
            "evidence": {"blocked_tasks": blocked_tasks},
        })
    if pending_approvals:
        findings.append({
            "severity": "medium",
            "category": "governance",
            "title": f"{pending_approvals} approval decision(s) are pending",
            "description": "Consequential actions cannot advance until their approval is decided.",
            "remediation": "Review the Approval Inbox and record a decision.",
            "blocking": True,
            "evidence": {"pending_approvals": pending_approvals},
        })
    if assets == 0:
        findings.append({
            "severity": "high",
            "category": "assets",
            "title": "No production assets are registered",
            "description": "Release provenance cannot be assembled without exact asset versions.",
            "remediation": "Register source materials and create immutable asset versions.",
            "blocking": True,
            "evidence": {"assets": 0},
        })
    elif approved_assets < assets:
        findings.append({
            "severity": "medium",
            "category": "assets",
            "title": "Some assets are not approved",
            "description": "A release must reference reviewed, immutable versions.",
            "remediation": "Complete creative, canon, and technical review for remaining assets.",
            "blocking": False,
            "evidence": {"assets": assets, "approved_assets": approved_assets},
        })
    if not automated_provider_ready:
        findings.append({
            "severity": "low",
            "category": "integrations",
            "title": "Automated render providers are not configured",
            "description": "The manual gateway remains available, but automated submission is disabled.",
            "remediation": "Configure approved provider credentials in the backend secret store.",
            "blocking": False,
            "evidence": {"manual_gateway_available": True},
        })
    if failed_render_count:
        findings.append({
            "severity": "high",
            "category": "render",
            "title": f"{failed_render_count} render request(s) failed",
            "description": "Failed external jobs require retry, fallback routing, or cancellation.",
            "remediation": "Inspect provider errors and route through an approved fallback.",
            "blocking": True,
            "evidence": {"failed_render_requests": failed_render_count},
        })

    blocking_findings = [finding for finding in findings if finding["blocking"]]
    release_ready = (
        overall >= 85
        and not blocking_findings
        and counts.get("open_tasks", 0) == 0
        and failed_tasks == 0
        and pending_approvals == 0
        and assets > 0
        and approved_assets == assets
    )
    severe_blocker = any(
        item["blocking"] and item["severity"] in {"high", "critical"}
        for item in findings
    )
    status = "passed" if release_ready else ("failed" if severe_blocker else "passed_with_warnings")
    summary = (
        "All required Genesis release gates passed."
        if release_ready
        else f"Project scored {overall:.2f}/100 with {len(blocking_findings)} blocking finding(s)."
    )
    gates = [
        {
            "gate_key": "canon_locked",
            "name": "Locked canon",
            "category": "canon",
            "status": "passed" if counts.get("locked_canon", 0) else "blocked",
            "evidence": {"locked_canon": counts.get("locked_canon", 0)},
        },
        {
            "gate_key": "workflow_complete",
            "name": "Workflow completion",
            "category": "workflow",
            "status": "passed"
            if counts.get("open_tasks", 0) == 0 and failed_tasks == 0 and total_tasks > 0
            else "blocked",
            "evidence": {
                "open_tasks": counts.get("open_tasks", 0),
                "failed_tasks": failed_tasks,
                "total_tasks": total_tasks,
            },
        },
        {
            "gate_key": "assets_approved",
            "name": "Approved immutable assets",
            "category": "assets",
            "status": "passed" if assets > 0 and approved_assets == assets else "blocked",
            "evidence": {"assets": assets, "approved_assets": approved_assets},
        },
        {
            "gate_key": "approvals_clear",
            "name": "Governance decisions complete",
            "category": "governance",
            "status": "passed" if pending_approvals == 0 else "blocked",
            "evidence": {"pending_approvals": pending_approvals},
        },
        {
            "gate_key": "provider_readiness",
            "name": "Render route available",
            "category": "integrations",
            "status": "passed" if automated_provider_ready else "warning",
            "evidence": {"automated_provider_ready": automated_provider_ready, "manual_gateway": True},
        },
    ]
    return QualityResult(
        scores=scores,
        overall_score=overall,
        release_ready=release_ready,
        status=status,
        summary=summary,
        findings=findings,
        gates=gates,
    )


class GenesisQualityService:
    def __init__(self, repo: GenesisRepository = repository) -> None:
        self.repo = repo

    async def run(self, project_id: UUID, user_id: str) -> dict[str, Any]:
        await self.repo.require_project_role(project_id, user_id, EVALUATION_ROLES)
        dashboard = await self.repo.command_center(project_id, user_id)
        counts = dashboard.get("counts") or {}
        tasks = await self.repo.list_rows("genesis_tasks", project_id, user_id, limit=500)
        renders = await self.repo.list_rows("genesis_render_requests", project_id, user_id, limit=500)
        failed_render_count = sum(1 for render in renders if render.get("status") == "failed")
        result = evaluate_project_state(
            counts=counts,
            tasks=tasks,
            providers=public_provider_health(),
            failed_render_count=failed_render_count,
        )
        evaluation = await self.repo.insert_project_row(
            "genesis_evaluation_runs",
            project_id,
            user_id,
            {
                "evaluation_type": "project_health",
                "status": result.status,
                "scores": result.scores,
                "overall_score": result.overall_score,
                "release_ready": result.release_ready,
                "summary": result.summary,
                "metadata": {"engine": "genesis-deterministic-v1", "finding_count": len(result.findings)},
                "created_by_user_id": user_id,
                "completed_at": datetime.now(timezone.utc).isoformat(),
            },
        )
        findings: list[dict[str, Any]] = []
        for finding in result.findings:
            row = await self.repo.insert_project_row(
                "genesis_findings",
                project_id,
                user_id,
                {**finding, "evaluation_run_id": evaluation["id"]},
            )
            findings.append(row)
        for gate in result.gates:
            await self.repo._request(
                "POST",
                "genesis_release_gates",
                payload={
                    "project_id": str(project_id),
                    **gate,
                    "evaluation_run_id": evaluation["id"],
                },
                prefer="resolution=merge-duplicates,return=minimal",
            )
        await self.repo.emit_event(
            project_id=project_id,
            event_type="evaluation.completed",
            aggregate_type="evaluation_run",
            aggregate_id=evaluation["id"],
            actor_type="user",
            actor_id=user_id,
            payload={
                "overall_score": result.overall_score,
                "release_ready": result.release_ready,
                "blocking_findings": sum(1 for item in result.findings if item["blocking"]),
            },
        )
        return {"evaluation": evaluation, "findings": findings, "gates": result.gates}


quality_service = GenesisQualityService()
