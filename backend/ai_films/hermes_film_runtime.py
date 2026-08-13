"""Runtime bridge from AI Films DAGs into durable Hermes execution."""
from __future__ import annotations

from backend.ai_films.hermes_film_dag import HermesFilmDAG
from backend.ai_films.hermes_workflow_adapter import film_dag_to_workflow
from backend.hermes.ports import Clock
from backend.hermes.workflows.checkpoints import WorkflowRecoveryService
from backend.hermes.workflows.coordinator import WorkflowExecutionCoordinator
from backend.hermes.workflows.engine import WorkflowEngine
from backend.hermes.workflows.models import WorkflowExecutionSnapshot


class HermesFilmRuntime:
    def __init__(
        self,
        *,
        coordinator: WorkflowExecutionCoordinator,
        recovery: WorkflowRecoveryService,
        clock: Clock,
    ) -> None:
        self._coordinator = coordinator
        self._recovery = recovery
        self._engine = WorkflowEngine(clock)

    async def start(
        self,
        dag: HermesFilmDAG,
        *,
        user_id: str,
        goal_id: str,
        execution_id: str | None = None,
    ) -> WorkflowExecutionSnapshot:
        definition = film_dag_to_workflow(dag)
        snapshot = self._engine.create_execution(
            definition,
            execution_id=execution_id,
            metadata={
                "source": "ai_films",
                "project_id": dag.project_id,
                "shot_id": dag.shot_id,
                "film_schema": dag.schema,
            },
        )
        snapshot = await self._recovery.save(
            definition,
            snapshot,
            user_id=user_id,
            goal_id=goal_id,
        )
        return await self._coordinator.dispatch_ready(
            definition,
            snapshot,
            user_id=user_id,
            goal_id=goal_id,
        )
