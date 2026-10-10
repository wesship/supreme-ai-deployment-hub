"""Event bridge that advances AI Films workflows from terminal Hermes task events."""
from __future__ import annotations

import asyncio
import json
from typing import Any

from backend.ai_films.hermes_film_dag import HermesFilmDAG
from backend.ai_films.hermes_film_runtime import HermesFilmRuntime
from backend.hermes.adapters import SupabaseCheckpointStore
from backend.hermes.dependencies import HermesDependencies
from backend.hermes.model_council.shadow_runtime import build_shadow_step_observer
from backend.hermes.workflows.checkpoints import WorkflowRecoveryService
from backend.hermes.workflows.coordinator import WorkflowExecutionCoordinator
from backend.hermes.workflows.reconciliation import WorkflowTaskReconciler


_SHADOW_TASKS: set[asyncio.Task[None]] = set()


async def advance_ai_film_for_task(task_id: str, dependencies: HermesDependencies) -> bool:
    """Advance the AI Films DAG bound to a terminal Hermes workflow task.

    Returns False when the task is not part of an AI Films workflow.
    """
    task_rows = await dependencies.repository.list_rows(
        "hermes_tasks",
        {"id": f"eq.{task_id}", "limit": "1"},
    )
    source_task = task_rows[0] if task_rows else {}
    source_input = source_task.get("input_data")
    if not isinstance(source_input, dict):
        source_input = {}
    source_agent = str(source_task.get("agent_name") or "unknown")

    rows = await dependencies.repository.list_rows(
        "hermes_checkpoints",
        {
            "content": f"like.*{task_id}*",
            "order": "created_at.desc",
            "limit": "1",
        },
    )
    if not rows:
        return False

    content = rows[0].get("content")
    if not isinstance(content, str):
        return False
    envelope = json.loads(content)
    if not isinstance(envelope, dict):
        return False
    snapshot = envelope.get("snapshot")
    if not isinstance(snapshot, dict):
        return False
    metadata = snapshot.get("metadata")
    if not isinstance(metadata, dict) or metadata.get("source") != "ai_films":
        return False

    raw_dag = metadata.get("film_dag")
    binding = metadata.get("runtime_binding")
    if not isinstance(raw_dag, dict) or not isinstance(binding, dict):
        return False

    user_id = str(binding.get("user_id") or "").strip()
    goal_id = str(binding.get("goal_id") or "").strip()
    execution_id = str(binding.get("execution_id") or "").strip()
    if not user_id or not goal_id or not execution_id:
        return False

    dag = HermesFilmDAG.model_validate(raw_dag)
    checkpoint_store = SupabaseCheckpointStore(dependencies.repository)  # type: ignore[arg-type]
    recovery = WorkflowRecoveryService(
        store=checkpoint_store,
        clock=dependencies.clock,
        event_sink=dependencies.event_sink,
    )
    reconciler = WorkflowTaskReconciler(
        repository=dependencies.repository,
        clock=dependencies.clock,
        event_sink=dependencies.event_sink,
    )
    coordinator = WorkflowExecutionCoordinator(
        repository=dependencies.repository,
        dispatcher=dependencies.dispatcher,
        recovery=recovery,
        clock=dependencies.clock,
        event_sink=dependencies.event_sink,
    )
    runtime = HermesFilmRuntime(
        coordinator=coordinator,
        recovery=recovery,
        reconciler=reconciler,
        clock=dependencies.clock,
    )
    advanced = await runtime.advance(
        dag,
        user_id=user_id,
        goal_id=goal_id,
        execution_id=execution_id,
    )
    await dependencies.event_sink.emit(
        {
            "event": "ai_films.workflow.auto_advanced",
            "task_id": task_id,
            "execution_id": execution_id,
            "workflow_id": advanced.workflow_id,
            "status": advanced.status.value,
        }
    )

    observer = build_shadow_step_observer(dependencies.event_sink)
    shadow_task = asyncio.create_task(
        observer(
            execution_id=execution_id,
            workflow_id=advanced.workflow_id,
            step_id=task_id,
            agent_name=source_agent,
            input_data=source_input,
        ),
        name=f"model-council-shadow:{task_id}",
    )
    _SHADOW_TASKS.add(shadow_task)
    shadow_task.add_done_callback(_SHADOW_TASKS.discard)
    return True
