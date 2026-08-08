"""Genesis application services.

This module implements a production-safe vertical slice: create a project, lock its
initial canon, create goals, bootstrap a durable workflow/task graph, transition tasks,
request governed renders, and decide approvals.
"""
from __future__ import annotations

import re
from datetime import datetime, timezone
from typing import Any
from uuid import UUID

from fastapi import HTTPException

from .permissions import (
    APPROVAL_DECISION_ROLES,
    CANON_LOCK_ROLES,
    CANON_PROPOSE_ROLES,
    PLANNING_ROLES,
    RENDER_REQUEST_ROLES,
    TASK_MUTATION_ROLES,
)
from .render_gateway import estimate_cost, public_provider_health
from .repository import GenesisRepository, repository
from .schemas import (
    ApprovalDecisionRequest,
    BootstrapWorkflowRequest,
    CreateCanonEntryRequest,
    CreateGoalRequest,
    CreateProjectRequest,
    CreateRenderRequest,
    TransitionTaskRequest,
)
from .workflow import InvalidTransition, build_bootstrap_tasks, validate_task_transition


CORE_AGENTS: tuple[dict[str, Any], ...] = (
    {
        "key": "HERMES_ORCHESTRATOR",
        "name": "Hermes Orchestrator",
        "agent_type": "orchestrator",
        "capabilities": ["planning", "delegation", "workflow_reconciliation", "approval_routing"],
        "governance_level": "supervised",
    },
    {
        "key": "GENESIS_PLANNER",
        "name": "Genesis Planner",
        "agent_type": "specialist",
        "capabilities": ["production_planning", "dependency_analysis", "milestone_design"],
        "governance_level": "assisted",
    },
    {
        "key": "CANON_GUARDIAN",
        "name": "Canon Guardian",
        "agent_type": "validator",
        "capabilities": ["canon_validation", "continuity", "conflict_detection"],
        "governance_level": "supervised",
    },
    {
        "key": "PRODUCTION_MANAGER",
        "name": "Genesis Production Manager",
        "agent_type": "observer",
        "capabilities": ["task_health", "asset_readiness", "release_readiness"],
        "governance_level": "assisted",
    },
    {
        "key": "TECHNICAL_QA",
        "name": "Genesis Technical QA",
        "agent_type": "validator",
        "capabilities": ["schema_validation", "security_review", "accessibility_review", "release_validation"],
        "governance_level": "supervised",
    },
)


def slugify(value: str) -> str:
    slug = re.sub(r"[^a-z0-9]+", "-", value.lower()).strip("-")
    return slug or "genesis-project"


def canonicalize(value: str) -> str:
    return re.sub(r"[^A-Z0-9]+", "_", value.upper()).strip("_")


class GenesisService:
    def __init__(self, repo: GenesisRepository = repository) -> None:
        self.repo = repo

    async def list_projects(self, user_id: str) -> list[dict[str, Any]]:
        return await self.repo.list_projects(user_id)

    async def create_project(self, body: CreateProjectRequest, user_id: str) -> dict[str, Any]:
        slug = body.slug or slugify(body.title)
        canonical_key = body.canonical_key or f"D3VONN.{canonicalize(body.project_type)}.{canonicalize(slug)}"
        project = await self.repo.create_project(
            {
                "canonical_key": canonical_key,
                "title": body.title,
                "slug": slug,
                "project_type": body.project_type,
                "description": body.description,
                "target_release_date": body.target_release_date.isoformat() if body.target_release_date else None,
                "metadata": {
                    "genesis_version": "1.0",
                    "implementation_status": "foundation",
                    **body.metadata,
                },
            },
            user_id,
        )
        await self._seed_project_foundation(project, user_id)
        return project

    async def _seed_project_foundation(self, project: dict[str, Any], user_id: str) -> None:
        project_id = project["id"]
        await self.repo.insert_project_row(
            "genesis_canon_entries",
            project_id,
            user_id,
            {
                "canonical_key": f"{project['canonical_key']}.LAW.PROVENANCE",
                "canon_type": "production_rule",
                "title": "Genesis provenance law",
                "content": {
                    "law": "Every approved asset must retain identity, version, source, validation, and approval history.",
                    "required": ["stable_id", "immutable_version", "provenance", "review_state"],
                },
                "authority_level": 4,
                "canon_status": "locked",
                "locked": True,
                "created_by": user_id,
                "approved_by": user_id,
            },
        )
        for agent in CORE_AGENTS:
            await self.repo.insert_project_row(
                "genesis_agents",
                project_id,
                user_id,
                {
                    "canonical_key": f"{project['canonical_key']}.AGENT.{agent['key']}",
                    "name": agent["name"],
                    "agent_type": agent["agent_type"],
                    "description": f"Project-scoped {agent['name']} for {project['title']}.",
                    "capabilities": agent["capabilities"],
                    "tool_permissions": {
                        "allowed": ["knowledge.query", "task.update", "asset.draft", "validation.submit"],
                        "approval_required": ["canon.lock", "render.submit", "release.publish"],
                        "denied": ["permission.change", "approved_asset.delete"],
                    },
                    "governance_level": agent["governance_level"],
                },
            )

    async def command_center(self, project_id: UUID, user_id: str) -> dict[str, Any]:
        dashboard = await self.repo.command_center(project_id, user_id)
        dashboard["provider_health"] = public_provider_health()
        dashboard["implementation"] = {
            "schema": "ready",
            "workflow_runtime": "ready",
            "render_gateway": "adapter_ready",
            "external_providers": "configuration_dependent",
        }
        return dashboard

    async def snapshot(self, project_id: UUID, user_id: str) -> dict[str, Any]:
        dashboard = await self.command_center(project_id, user_id)
        dashboard["goals"] = await self.repo.list_rows("genesis_goals", project_id, user_id, limit=25)
        dashboard["tasks"] = await self.repo.list_rows("genesis_tasks", project_id, user_id, limit=100)
        dashboard["workflows"] = await self.repo.list_rows("genesis_workflow_runs", project_id, user_id, limit=25)
        dashboard["approvals"] = await self.repo.list_rows(
            "genesis_approvals",
            project_id,
            user_id,
            limit=50,
            extra_params={"status": "eq.pending"},
        )
        dashboard["canon"] = await self.repo.list_rows("genesis_canon_entries", project_id, user_id, limit=50)
        dashboard["render_requests"] = await self.repo.list_rows("genesis_render_requests", project_id, user_id, limit=25)
        return dashboard

    async def create_canon(
        self,
        project_id: UUID,
        body: CreateCanonEntryRequest,
        user_id: str,
    ) -> dict[str, Any]:
        allowed_roles = CANON_LOCK_ROLES if body.lock else CANON_PROPOSE_ROLES
        await self.repo.require_project_role(project_id, user_id, allowed_roles)
        project = await self.repo.get_row("genesis_projects", project_id)
        if not project:
            raise HTTPException(404, "Project not found")
        entry = await self.repo.insert_project_row(
            "genesis_canon_entries",
            project_id,
            user_id,
            {
                "canonical_key": f"{project['canonical_key']}.CANON.{canonicalize(body.canon_type)}.{canonicalize(body.title)}",
                "canon_type": body.canon_type,
                "title": body.title,
                "content": body.content,
                "authority_level": 4 if body.lock else body.authority_level,
                "canon_status": "locked" if body.lock else "proposed",
                "locked": body.lock,
                "created_by": user_id,
                "approved_by": user_id if body.lock else None,
            },
        )
        await self.repo.emit_event(
            project_id=project_id,
            event_type="canon.locked" if body.lock else "canon.proposed",
            aggregate_type="canon_entry",
            aggregate_id=entry["id"],
            actor_type="user",
            actor_id=user_id,
            payload={"title": entry["title"], "authority_level": entry["authority_level"]},
        )
        return entry

    async def create_goal(self, project_id: UUID, body: CreateGoalRequest, user_id: str) -> dict[str, Any]:
        await self.repo.require_project_role(project_id, user_id, PLANNING_ROLES)
        goal = await self.repo.insert_project_row(
            "genesis_goals",
            project_id,
            user_id,
            {
                "title": body.title,
                "objective": body.objective,
                "priority": body.priority,
                "status": "active" if body.auto_start else "draft",
                "success_criteria": body.success_criteria,
                "constraints": body.constraints,
                "initiated_by_user_id": user_id,
            },
        )
        await self.repo.emit_event(
            project_id=project_id,
            event_type="goal.created",
            aggregate_type="goal",
            aggregate_id=goal["id"],
            actor_type="user",
            actor_id=user_id,
            payload={"title": goal["title"], "status": goal["status"]},
        )
        return goal

    async def bootstrap_workflow(
        self,
        project_id: UUID,
        body: BootstrapWorkflowRequest,
        user_id: str,
    ) -> dict[str, Any]:
        await self.repo.require_project_role(project_id, user_id, PLANNING_ROLES)
        goal = await self.create_goal(
            project_id,
            CreateGoalRequest(
                title=body.goal_title,
                objective="Implement and validate the Genesis project foundation from canon through release readiness.",
                priority=1,
                success_criteria=[
                    "Canon foundation is locked",
                    "Knowledge, production, asset, QA, render, and release tasks are represented",
                    "Every task has acceptance criteria and explicit dependencies",
                ],
                constraints=[
                    "Do not publish externally without approval",
                    "Do not modify locked canon without explicit approval",
                ],
            ),
            user_id,
        )
        workflow = await self.repo.insert_project_row(
            "genesis_workflow_runs",
            project_id,
            user_id,
            {
                "workflow_key": "genesis_project_bootstrap",
                "status": "running",
                "context": {"goal_id": goal["id"], "mode": "supervised"},
                "current_phase": "foundation",
                "initiated_by_user_id": user_id,
                "started_at": datetime.now(timezone.utc).isoformat(),
            },
        )
        task_specs = build_bootstrap_tasks(
            include_render_readiness=body.include_render_readiness,
            include_release_readiness=body.include_release_readiness,
        )
        task_ids: dict[str, str] = {}
        tasks: list[dict[str, Any]] = []
        for spec in task_specs:
            dependencies = [task_ids[key] for key in spec["dependencies"] if key in task_ids]
            task = await self.repo.insert_project_row(
                "genesis_tasks",
                project_id,
                user_id,
                {
                    "goal_id": goal["id"],
                    "canonical_key": f"{project_id}.TASK.{canonicalize(spec['key'])}.{workflow['id']}",
                    "title": spec["title"],
                    "task_type": spec["task_type"],
                    "priority": spec["priority"],
                    "status": "ready" if not dependencies else "backlog",
                    "acceptance_criteria": spec["acceptance_criteria"],
                    "dependencies": dependencies,
                    "input": {"workflow_run_id": workflow["id"], "step_key": spec["key"]},
                },
            )
            task_ids[spec["key"]] = task["id"]
            tasks.append(task)
            await self.repo._request(
                "POST",
                "genesis_workflow_steps",
                payload={
                    "workflow_run_id": workflow["id"],
                    "step_key": spec["key"],
                    "name": spec["title"],
                    "step_type": "agent" if spec["task_type"] not in {"release"} else "approval",
                    "status": "ready" if not dependencies else "pending",
                    "sequence_order": len(tasks),
                    "depends_on": dependencies,
                    "input": {"task_id": task["id"]},
                },
                prefer="return=minimal",
            )
        await self.repo.emit_event(
            project_id=project_id,
            event_type="workflow.started",
            aggregate_type="workflow_run",
            aggregate_id=workflow["id"],
            actor_type="user",
            actor_id=user_id,
            payload={"workflow_key": workflow["workflow_key"], "task_count": len(tasks), "goal_id": goal["id"]},
        )
        return {"goal": goal, "workflow": workflow, "tasks": tasks}

    async def transition_task(
        self,
        task_id: UUID,
        body: TransitionTaskRequest,
        user_id: str,
    ) -> dict[str, Any]:
        task = await self.repo.get_row("genesis_tasks", task_id)
        if not task:
            raise HTTPException(404, "Genesis task not found")
        await self.repo.require_project_role(task["project_id"], user_id, TASK_MUTATION_ROLES)
        try:
            validate_task_transition(task["status"], body.status)
        except InvalidTransition as exc:
            raise HTTPException(422, str(exc)) from exc
        completed_at = (
            datetime.now(timezone.utc).isoformat()
            if body.status in {"completed", "cancelled", "failed"}
            else None
        )
        return await self.repo.transition_task_atomic(
            task_id=task_id,
            expected_status=task["status"],
            new_status=body.status,
            output=body.output,
            completed_at=completed_at,
            actor_id=user_id,
            reason=body.reason,
        )

    async def create_render_request(
        self,
        project_id: UUID,
        body: CreateRenderRequest,
        user_id: str,
    ) -> dict[str, Any]:
        await self.repo.require_project_role(project_id, user_id, RENDER_REQUEST_ROLES)
        estimate = estimate_cost(
            domain=body.domain,
            operation=body.operation,
            normalized_request=body.normalized_request,
            routing_profile=body.routing_profile,
            maximum_cost_usd=body.maximum_cost_usd,
        )
        render = await self.repo.insert_project_row(
            "genesis_render_requests",
            project_id,
            user_id,
            {
                "domain": body.domain,
                "operation": body.operation,
                "objective": body.objective,
                "normalized_request": body.normalized_request,
                "routing_profile": body.routing_profile,
                "status": "approval_pending" if estimate.approval_required else "estimated",
                "selected_provider": estimate.provider,
                "selected_model": estimate.model,
                "maximum_cost_usd": body.maximum_cost_usd,
                "estimated_cost_usd": estimate.estimated_cost_usd,
                "idempotency_key": body.idempotency_key,
                "created_by_user_id": user_id,
            },
        )
        approval = None
        if estimate.approval_required:
            approval = await self.repo.insert_project_row(
                "genesis_approvals",
                project_id,
                user_id,
                {
                    "target_type": "render_request",
                    "target_id": render["id"],
                    "approval_type": "render_cost",
                    "status": "pending",
                    "requested_by_user_id": user_id,
                    "risk_level": "medium",
                    "estimated_cost_usd": estimate.maximum_cost_usd,
                    "conditions": {"maximum_cost_usd": body.maximum_cost_usd},
                },
            )
        await self.repo.emit_event(
            project_id=project_id,
            event_type="render.approval_requested" if approval else "render.cost_estimated",
            aggregate_type="render_request",
            aggregate_id=render["id"],
            actor_type="user",
            actor_id=user_id,
            payload=estimate.model_dump(),
        )
        return {"render_request": render, "estimate": estimate.model_dump(), "approval": approval}

    async def decide_approval(
        self,
        approval_id: UUID,
        body: ApprovalDecisionRequest,
        user_id: str,
    ) -> dict[str, Any]:
        approval = await self.repo.get_row("genesis_approvals", approval_id)
        if not approval:
            raise HTTPException(404, "Genesis approval not found")
        await self.repo.require_project_role(
            approval["project_id"],
            user_id,
            APPROVAL_DECISION_ROLES,
        )
        if approval["status"] != "pending":
            raise HTTPException(409, "Approval has already been decided")
        return await self.repo.decide_approval_atomic(
            approval_id=approval_id,
            decision=body.decision,
            decided_by_user_id=user_id,
            notes=body.notes,
            conditions=body.conditions or approval.get("conditions") or {},
        )


service = GenesisService()
