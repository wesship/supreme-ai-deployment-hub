"""Hermes bridge for the durable AI FILMS mastering/QC control plane."""
from __future__ import annotations

import logging
from typing import Any

from backend.hermes.contracts import TaskStatus
from backend.hermes.dependencies import get_dependencies
from backend.hermes.ports import AgentDispatcher, TaskRepository
from backend.hermes.task_engine import get_task, transition_task

logger = logging.getLogger(__name__)
MASTERING_AGENT = "ai-films-mastering"


class HermesMasteringDispatcher:
    """Route only AI FILMS mastering to the durable render-job queue.

    All other agents continue through the existing Hermes dispatcher. The bridge
    is idempotent by Hermes task id, so retries/recovery cannot create a second
    mastering execution path.
    """

    def __init__(self, repository: TaskRepository, fallback: AgentDispatcher) -> None:
        self._repository = repository
        self._fallback = fallback

    @property
    def configured(self) -> bool:
        return bool(getattr(self._repository, "configured", False))

    async def dispatch(
        self,
        *,
        task_id: str,
        agent_name: str,
        input_data: dict[str, Any],
        idempotency_key: str | None = None,
    ) -> dict[str, Any]:
        if agent_name.strip().lower() != MASTERING_AGENT:
            return await self._fallback.dispatch(
                task_id=task_id,
                agent_name=agent_name,
                input_data=input_data,
                idempotency_key=idempotency_key,
            )

        existing = await self._repository.list_rows(
            "ai_film_render_jobs",
            {
                "job_type": "eq.mastering",
                "provider": "eq.ffmpeg",
                "input->>hermes_task_id": f"eq.{task_id}",
                "order": "created_at.desc",
                "limit": "1",
            },
        )
        if existing:
            return self._result(existing[0], reused=True)

        film_node = input_data.get("film_node") if isinstance(input_data.get("film_node"), dict) else {}
        node_inputs = film_node.get("inputs") if isinstance(film_node.get("inputs"), dict) else {}
        project_id = str(input_data.get("project_id") or "").strip()
        shot_id = str(input_data.get("shot_id") or film_node.get("shot_id") or "").strip()
        source_asset_id = str(
            input_data.get("source_asset_id")
            or node_inputs.get("source_asset_id")
            or film_node.get("source_asset_id")
            or ""
        ).strip()
        start_timecode = str(
            input_data.get("start_timecode") or node_inputs.get("start_timecode") or ""
        ).strip() or None
        if not project_id or not shot_id or not source_asset_id:
            raise ValueError(
                "ai-films-mastering requires project_id, shot_id, and source_asset_id"
            )

        projects = await self._repository.list_rows(
            "ai_film_projects",
            {"id": f"eq.{project_id}", "select": "id,owner_id", "limit": "1"},
        )
        if not projects or not projects[0].get("owner_id"):
            raise ValueError("AI FILMS project owner could not be resolved for Hermes mastering")
        owner_id = str(projects[0]["owner_id"])

        source = await self._repository.list_rows(
            "ai_film_assets",
            {
                "id": f"eq.{source_asset_id}",
                "project_id": f"eq.{project_id}",
                "owner_id": f"eq.{owner_id}",
                "select": "id",
                "limit": "1",
            },
        )
        if not source:
            raise ValueError("Hermes mastering source asset failed owner/project isolation")

        job = await self._repository.create_row(
            "ai_film_render_jobs",
            {
                "project_id": project_id,
                "owner_id": owner_id,
                "job_type": "mastering",
                "provider": "ffmpeg",
                "status": "queued",
                "priority": 95,
                "progress": 0,
                "input": {
                    "source_asset_id": source_asset_id,
                    "shot_id": shot_id,
                    "start_timecode": start_timecode,
                    "pipeline": "ffprobe->camera-color->acescg->openexr->otio->durable-storage->master-qc",
                    "hermes_task_id": task_id,
                    "hermes_idempotency_key": idempotency_key,
                    "hermes_execution_id": (input_data.get("_hermes") or {}).get("execution_id")
                    if isinstance(input_data.get("_hermes"), dict)
                    else None,
                },
                "output": {"qa": {"state": "pending_mastering"}},
            },
        )
        return self._result(job, reused=False)

    @staticmethod
    def _result(job: dict[str, Any], *, reused: bool) -> dict[str, Any]:
        return {
            "status": "queued",
            "external": True,
            "reused": reused,
            "render_job_id": str(job.get("id") or ""),
            "job_type": "mastering",
            "provider": "ffmpeg",
            "completion_condition": "master_qa_passed",
        }


async def finalize_hermes_mastering_task(job: dict[str, Any], *, passed: bool, certification: dict[str, Any]) -> bool:
    """Finish the bound Hermes task after master QC reaches a terminal state."""
    payload = job.get("input") if isinstance(job.get("input"), dict) else {}
    task_id = str(payload.get("hermes_task_id") or "").strip()
    if not task_id:
        return False

    task = await get_task(task_id)
    if not task:
        logger.warning("Hermes mastering handoff task not found: %s", task_id)
        return False

    status = TaskStatus(task["status"])
    if status in {TaskStatus.COMPLETED, TaskStatus.FAILED, TaskStatus.CANCELLED}:
        return True
    if status is TaskStatus.PENDING:
        await transition_task(task_id, TaskStatus.LOCKED, agent_name=MASTERING_AGENT)
        status = TaskStatus.LOCKED
    if status is TaskStatus.LOCKED:
        await transition_task(task_id, TaskStatus.RUNNING, agent_name=MASTERING_AGENT)
        status = TaskStatus.RUNNING
    if status is not TaskStatus.RUNNING:
        raise RuntimeError(f"Hermes mastering task is not terminalizable from {status.value}")

    output = job.get("output") if isinstance(job.get("output"), dict) else {}
    if passed:
        await transition_task(
            task_id,
            TaskStatus.COMPLETED,
            output_data={
                "render_job_id": str(job.get("id") or ""),
                "master_package_asset_id": output.get("master_package_asset_id"),
                "checksum": output.get("checksum"),
                "qa": certification,
                "state": "master_qa_passed",
            },
            agent_name=MASTERING_AGENT,
        )
    else:
        await transition_task(
            task_id,
            TaskStatus.FAILED,
            error_message="AI FILMS master QC failed",
            output_data={
                "render_job_id": str(job.get("id") or ""),
                "master_package_asset_id": output.get("master_package_asset_id"),
                "qa": certification,
                "state": "master_qa_failed",
            },
            agent_name=MASTERING_AGENT,
        )

    try:
        from backend.ai_films.hermes_task_event_bridge import advance_ai_film_for_task

        await advance_ai_film_for_task(task_id, get_dependencies())
    except Exception:
        logger.exception("Hermes AI FILMS workflow auto-advance failed for mastering task %s", task_id)
        raise
    return True
