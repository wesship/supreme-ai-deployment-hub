from __future__ import annotations

from datetime import datetime, timezone

import pytest

from backend.ai_films.film_node_contracts import FilmNode
from backend.ai_films.hermes_film_dag import HermesFilmDAG
from backend.ai_films.hermes_film_runtime import HermesFilmRuntime
from backend.ai_films.hermes_task_event_bridge import advance_ai_film_for_task
from backend.hermes.adapters import SupabaseCheckpointStore
from backend.hermes.dependencies import HermesDependencies
from backend.hermes.testing import FrozenClock, InMemoryAgentDispatcher, InMemoryEventSink, InMemoryTaskRepository
from backend.hermes.workflows.checkpoints import WorkflowRecoveryService
from backend.hermes.workflows.coordinator import WorkflowExecutionCoordinator
from backend.hermes.workflows.reconciliation import WorkflowTaskReconciler


def _dag() -> HermesFilmDAG:
    shot_id = "SEQ01-SC01-SH001"
    first = FilmNode(node_id=f"{shot_id}:generate", shot_id=shot_id, kind="generation", task_type="generate_shot")
    second = FilmNode(
        node_id=f"{shot_id}:continuity-qc",
        shot_id=shot_id,
        kind="qc",
        task_type="continuity_qc",
        depends_on=[first.node_id],
    )
    return HermesFilmDAG(project_id="project-1", shot_id=shot_id, nodes=[first, second])


def _runtime(deps: HermesDependencies) -> HermesFilmRuntime:
    store = SupabaseCheckpointStore(deps.repository)  # type: ignore[arg-type]
    recovery = WorkflowRecoveryService(store=store, clock=deps.clock, event_sink=deps.event_sink)
    reconciler = WorkflowTaskReconciler(repository=deps.repository, clock=deps.clock, event_sink=deps.event_sink)
    coordinator = WorkflowExecutionCoordinator(
        repository=deps.repository,
        dispatcher=deps.dispatcher,
        recovery=recovery,
        clock=deps.clock,
        event_sink=deps.event_sink,
    )
    return HermesFilmRuntime(coordinator=coordinator, recovery=recovery, reconciler=reconciler, clock=deps.clock)


@pytest.mark.asyncio
async def test_terminal_task_auto_advances_once_and_duplicate_callback_does_not_redispatch() -> None:
    repository = InMemoryTaskRepository()
    dispatcher = InMemoryAgentDispatcher()
    events = InMemoryEventSink()
    clock = FrozenClock(datetime(2026, 8, 13, 22, 50, tzinfo=timezone.utc))
    deps = HermesDependencies(repository=repository, dispatcher=dispatcher, event_sink=events, clock=clock)
    dag = _dag()

    started = await _runtime(deps).start(
        dag,
        user_id="user-1",
        goal_id="goal-1",
        execution_id="film-exec-1",
    )
    assert len(dispatcher.calls) == 1
    first_task_id = started.steps[f"{dag.shot_id}.generate"].task_id
    assert first_task_id

    await repository.update_row(
        "hermes_tasks",
        first_task_id,
        {"status": "COMPLETED", "output_data": {"asset_id": "asset-1"}, "completed_at": clock.now().isoformat()},
    )

    assert await advance_ai_film_for_task(first_task_id, deps) is True
    assert len(dispatcher.calls) == 2
    assert dispatcher.calls[-1]["input"]["film_node"]["task_type"] == "continuity_qc"

    assert await advance_ai_film_for_task(first_task_id, deps) is True
    assert len(dispatcher.calls) == 2

    auto_events = [event for event in events.events if event.get("event") == "ai_films.workflow.auto_advanced"]
    assert len(auto_events) == 2
