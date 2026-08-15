"""
Devonn.ai Workflow Engine

Executes multi-step workflows where each step can be an LLM call,
a tool invocation, or a conditional branch.
"""
from __future__ import annotations

import asyncio
import logging
import time
import uuid
from enum import Enum
from typing import Any, Callable, Dict, List, Optional

from pydantic import BaseModel, Field

logger = logging.getLogger(__name__)


class StepStatus(str, Enum):
    PENDING = "pending"
    RUNNING = "running"
    SUCCESS = "success"
    FAILED = "failed"
    SKIPPED = "skipped"


class WorkflowStep(BaseModel):
    """A single step in a workflow."""
    step_id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    name: str
    step_type: str  # "llm", "tool", "condition", "transform"
    config: Dict[str, Any] = Field(default_factory=dict)
    depends_on: List[str] = Field(default_factory=list)
    status: StepStatus = StepStatus.PENDING
    result: Optional[Any] = None
    error: Optional[str] = None
    started_at: Optional[float] = None
    completed_at: Optional[float] = None


class WorkflowDefinition(BaseModel):
    """A named, reusable workflow definition."""
    workflow_id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    name: str
    description: Optional[str] = None
    steps: List[WorkflowStep]
    timeout_seconds: int = 300
    created_at: float = Field(default_factory=time.time)


class WorkflowRun(BaseModel):
    """A live execution of a workflow."""
    run_id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    workflow_id: str
    workflow_name: str
    status: StepStatus = StepStatus.PENDING
    context: Dict[str, Any] = Field(default_factory=dict)
    step_results: Dict[str, Any] = Field(default_factory=dict)
    started_at: Optional[float] = None
    completed_at: Optional[float] = None
    error: Optional[str] = None


class WorkflowEngine:
    """Executes multi-step workflows with dependency resolution."""

    def __init__(self):
        self._definitions: Dict[str, WorkflowDefinition] = {}
        self._step_handlers: Dict[str, Callable] = {}
        self._active_runs: Dict[str, WorkflowRun] = {}

    def register_workflow(self, definition: WorkflowDefinition) -> None:
        """Register a workflow definition."""
        self._definitions[definition.name] = definition
        logger.info("Registered workflow: %s", definition.name)

    def register_step_handler(self, step_type: str, handler: Callable) -> None:
        """Register a handler for a step type."""
        self._step_handlers[step_type] = handler

    def get_run(self, run_id: str) -> Optional[WorkflowRun]:
        """Get a workflow run by ID."""
        return self._active_runs.get(run_id)

    def list_workflows(self) -> List[str]:
        """List all registered workflow names."""
        return list(self._definitions.keys())

    async def execute(
        self,
        workflow_name: str,
        context: Dict[str, Any] = None
    ) -> WorkflowRun:
        """Execute a workflow by name and return the run record."""
        if workflow_name not in self._definitions:
            raise ValueError(f"Workflow '{workflow_name}' not found.")

        definition = self._definitions[workflow_name]
        run = WorkflowRun(
            workflow_id=definition.workflow_id,
            workflow_name=workflow_name,
            context=context or {}
        )
        self._active_runs[run.run_id] = run
        run.status = StepStatus.RUNNING
        run.started_at = time.time()

        try:
            await asyncio.wait_for(
                self._run_steps(definition, run),
                timeout=definition.timeout_seconds
            )
            run.status = StepStatus.SUCCESS
        except asyncio.TimeoutError:
            run.status = StepStatus.FAILED
            run.error = f"Workflow timed out after {definition.timeout_seconds}s"
            logger.error("Workflow execution timed out")
        except Exception as exc:
            run.status = StepStatus.FAILED
            run.error = str(exc)
            logger.error("Workflow execution failed")
        finally:
            run.completed_at = time.time()

        return run

    async def _run_steps(self, definition: WorkflowDefinition, run: WorkflowRun) -> None:
        """Execute all steps in dependency order."""
        completed: set = set()

        for step in definition.steps:
            # Check dependencies
            if not all(dep in completed for dep in step.depends_on):
                step.status = StepStatus.SKIPPED
                logger.warning("Skipping step %s: unmet dependencies", step.name)
                continue

            step.status = StepStatus.RUNNING
            step.started_at = time.time()

            try:
                handler = self._step_handlers.get(step.step_type)
                if handler is None:
                    raise ValueError(f"No handler registered for step type '{step.step_type}'")

                result = await handler(step, run.context, run.step_results)
                step.result = result
                run.step_results[step.step_id] = result
                step.status = StepStatus.SUCCESS
                completed.add(step.step_id)
                logger.info("Step %s completed successfully", step.name)

            except Exception as exc:
                step.status = StepStatus.FAILED
                step.error = str(exc)
                logger.error("Step %s failed: %s", step.name, exc)
                raise


# Global singleton instance
workflow_engine = WorkflowEngine()
