"""Runtime bridge from AI Films DAGs into durable Hermes execution."""
from __future__ import annotations

from uuid import uuid4

from backend.ai_films.hermes_film_dag import HermesFilmDAG
from backend.ai_films.hermes_workflow_adapter import film_dag_to_workflow
from backend.hermes.ports import Clock
from backend.hermes.workflows.checkpoints import WorkflowRecoveryService
from backend.hermes.workflows.coordinator import WorkflowExecutionCoordinator
from backend.hermes.workflows.engine import WorkflowEngine
from backend.hermes.workflows.models import WorkflowExecutionSnapshot, WorkflowStatus
from backend.hermes.workflows.reconciliation import WorkflowTaskReconciler


class HermesFilmRuntime:
    def __init__(self, *, coordinator: WorkflowExecutionCoordinator, recovery: WorkflowRecoveryService, reconciler: WorkflowTaskReconciler, clock: Clock) -> None:
        self._coordinator = coordinator
        self._recovery = recovery
        self._reconciler = reconciler
        self._engine = WorkflowEngine(clock)

    async def start(self, dag: HermesFilmDAG, *, user_id: str, goal_id: str, execution_id: str | None = None) -> WorkflowExecutionSnapshot:
        definition = film_dag_to_workflow(dag)
        resolved_execution_id = execution_id or str(uuid4())
        snapshot = self._engine.create_execution(
            definition,
            execution_id=resolved_execution_id,
            metadata={
                "source": "ai_films",
                "project_id": dag.project_id,
                "shot_id": dag.shot_id,
                "film_schema": dag.schema,
                "film_dag": dag.model_dump(mode="json"),
                "runtime_binding": {"user_id": user_id, "goal_id": goal_id, "execution_id": resolved_execution_id},
            },
        )
        snapshot = await self._recovery.save(definition, snapshot, user_id=user_id, goal_id=goal_id)
        return await self._coordinator.dispatch_ready(definition, snapshot, user_id=user_id, goal_id=goal_id)

    async def advance(self, dag: HermesFilmDAG, *, user_id: str, goal_id: str, execution_id: str) -> WorkflowExecutionSnapshot:
        definition = film_dag_to_workflow(dag)
        snapshot = await self._recovery.recover_latest(definition, goal_id=goal_id, execution_id=execution_id)
        snapshot = await self._reconciler.reconcile(definition, snapshot)
        snapshot = self._engine.refresh_ready_steps(definition, snapshot)
        snapshot = await self._recovery.save(definition, snapshot, user_id=user_id, goal_id=goal_id)
        if snapshot.status in {WorkflowStatus.COMPLETED, WorkflowStatus.FAILED, WorkflowStatus.CANCELLED}:
            return snapshot
        return await self._coordinator.dispatch_ready(definition, snapshot, user_id=user_id, goal_id=goal_id)
