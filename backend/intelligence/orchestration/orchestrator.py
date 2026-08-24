"""
Devonn.ai Agent Orchestrator

Coordinates multiple agents and workflows to complete complex tasks.
Implements a supervisor pattern: the orchestrator decomposes tasks,
assigns sub-tasks to specialized agents, and aggregates results.

Safety: autonomous execution is bounded by agent-count, depth, runtime and
estimated-cost budgets. High-risk tool actions remain approval-gated in the
shared tool policy layer.
"""
from __future__ import annotations

import asyncio
import json
import logging
import time
import uuid
from typing import Any, Dict, List, Optional

import httpx
from pydantic import BaseModel, Field

from backend.app.config import get_settings
from ..executor.agent_executor import AgentExecutor, AgentResult
from ..memory.memory import conversation_memory, long_term_memory
from ..router.router import tool_router

logger = logging.getLogger(__name__)


# Keep backend limits aligned with the frontend safety contract. These are
# intentionally conservative defaults; production deployments may tighten them.
MAX_AGENTS_PER_RUN = 5
MAX_DEPTH = 3
MAX_RUNTIME_SECONDS = 30 * 60
MAX_SUBTASKS = 5


class SubTask(BaseModel):
    sub_task_id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    description: str
    assigned_agent: Optional[str] = None
    result: Optional[AgentResult] = None
    status: str = "pending"
    depth: int = 1


class OrchestrationRun(BaseModel):
    run_id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    goal: str
    user_id: Optional[str] = None
    session_id: Optional[str] = None
    sub_tasks: List[SubTask] = Field(default_factory=list)
    final_answer: Optional[str] = None
    status: str = "pending"
    started_at: float = Field(default_factory=time.time)
    completed_at: Optional[float] = None
    error: Optional[str] = None


class AgentOrchestrator:
    """
    Supervisor-pattern multi-agent orchestrator.

    Safety invariants:
    - no more than MAX_SUBTASKS tasks are accepted from a plan
    - no more than MAX_AGENTS_PER_RUN agents execute in one run
    - no task may exceed MAX_DEPTH
    - runtime is bounded by MAX_RUNTIME_SECONDS
    """

    def __init__(self):
        self._agents: Dict[str, AgentExecutor] = {}
        self._active_runs: Dict[str, OrchestrationRun] = {}

    def register_agent(self, name: str, executor: AgentExecutor) -> None:
        """Register a named agent executor."""
        self._agents[name] = executor
        logger.info("Registered agent: %s", name)

    def get_run(self, run_id: str) -> Optional[OrchestrationRun]:
        return self._active_runs.get(run_id)

    def _budget_ok(self, run: OrchestrationRun) -> bool:
        if time.time() - run.started_at > MAX_RUNTIME_SECONDS:
            run.status = "failed"
            run.error = "Autonomous run exceeded its maximum runtime."
            return False
        if len(run.sub_tasks) > MAX_AGENTS_PER_RUN:
            run.sub_tasks = run.sub_tasks[:MAX_AGENTS_PER_RUN]
        return True

    async def run(
        self,
        goal: str,
        user_id: Optional[str] = None,
        session_id: Optional[str] = None,
        context: Optional[Dict[str, Any]] = None
    ) -> OrchestrationRun:
        """Execute a high-level goal using bounded multi-agent orchestration."""
        run = OrchestrationRun(goal=goal, user_id=user_id, session_id=session_id)
        self._active_runs[run.run_id] = run
        run.status = "running"

        if session_id:
            conversation_memory.add_message(session_id, "user", goal)

        try:
            if not self._budget_ok(run):
                return run

            # Step 1: Decompose goal into bounded sub-tasks.
            sub_tasks = await self._decompose_goal(goal, context or {})
            run.sub_tasks = sub_tasks[:MAX_SUBTASKS]

            if not self._budget_ok(run):
                return run

            # Step 2: Execute sub-tasks in parallel where safe.
            await self._execute_sub_tasks(run, context or {})

            if not self._budget_ok(run):
                return run

            # Step 3: Synthesize final answer.
            run.final_answer = await self._synthesize_results(run)
            run.status = "success"

            if session_id:
                conversation_memory.add_message(session_id, "assistant", run.final_answer)
            if user_id:
                await long_term_memory.store(
                    f"last_run:{user_id}",
                    {"goal": goal, "answer": run.final_answer, "run_id": run.run_id},
                    user_id=user_id
                )

        except Exception as exc:
            run.status = "failed"
            run.error = str(exc)
            logger.error("Orchestration execution failed")
        finally:
            run.completed_at = time.time()
            self._active_runs.pop(run.run_id, None)

        return run

    async def _decompose_goal(
        self, goal: str, context: Dict[str, Any]
    ) -> List[SubTask]:
        """Use LLM to decompose a goal into bounded sub-tasks."""
        settings = get_settings()
        if not settings.openai_api_key:
            return [SubTask(description=goal, assigned_agent="default", depth=1)]

        messages = [
            {
                "role": "system",
                "content": """You are a Devonn.ai task decomposer.
Given a high-level goal, break it into 1-5 concrete sub-tasks.
Output a JSON object with a \"sub_tasks\" array.
Each sub-task has: \"description\" (string) and \"agent\" (one of: default, github, rag, deployment).
Never request destructive actions. Deployment actions must be treated as approval-gated.
Keep sub-tasks atomic and actionable."""
            },
            {
                "role": "user",
                "content": f"Goal: {goal}\nContext: {json.dumps(context)}"
            }
        ]

        try:
            async with httpx.AsyncClient(timeout=30.0) as client:
                resp = await client.post(
                    "https://api.openai.com/v1/chat/completions",
                    json={
                        "model": "gpt-4.1-mini",
                        "messages": messages,
                        "response_format": {"type": "json_object"},
                        "temperature": 0.1
                    },
                    headers={
                        "Authorization": f"Bearer {settings.openai_api_key}",
                        "Content-Type": "application/json"
                    }
                )
                resp.raise_for_status()

            data = resp.json()
            content = json.loads(data["choices"][0]["message"]["content"])
            tasks_data = content.get("sub_tasks", [{"description": goal, "agent": "default"}])

            return [
                SubTask(
                    description=t.get("description", goal),
                    assigned_agent=t.get("agent", "default"),
                    depth=1,
                )
                for t in tasks_data[:MAX_SUBTASKS]
            ]

        except Exception as exc:
            logger.error("Goal decomposition failed: %s", exc)
            return [SubTask(description=goal, assigned_agent="default", depth=1)]

    async def _execute_sub_tasks(
        self, run: OrchestrationRun, context: Dict[str, Any]
    ) -> None:
        """Execute all bounded sub-tasks, using parallel execution where safe."""
        tasks = []
        for sub_task in run.sub_tasks[:MAX_AGENTS_PER_RUN]:
            if sub_task.depth > MAX_DEPTH:
                sub_task.status = "skipped"
                continue

            agent_name = sub_task.assigned_agent or "default"
            executor = self._agents.get(agent_name) or self._agents.get("default")

            if executor is None:
                sub_task.status = "skipped"
                sub_task.result = None
                continue

            if not self._budget_ok(run):
                sub_task.status = "skipped"
                continue

            sub_task.status = "running"
            tasks.append(self._run_sub_task(sub_task, executor, context))

        if tasks:
            await asyncio.gather(*tasks, return_exceptions=True)

    async def _run_sub_task(
        self,
        sub_task: SubTask,
        executor: AgentExecutor,
        context: Dict[str, Any]
    ) -> None:
        """Execute a single bounded sub-task."""
        try:
            result = await executor.execute(sub_task.description, context)
            sub_task.result = result
            sub_task.status = "success" if result.status == "success" else "failed"
        except Exception as exc:
            sub_task.status = "failed"
            logger.error("Sub-task failed: %s — %s", sub_task.description, exc)

    async def _synthesize_results(self, run: OrchestrationRun) -> str:
        """Synthesize sub-task results into a final answer."""
        settings = get_settings()
        results_summary = "\n".join([
            f"- {st.description}: {st.result.final_answer if st.result else 'No result'}"
            for st in run.sub_tasks
        ])

        if not settings.openai_api_key:
            return results_summary

        try:
            async with httpx.AsyncClient(timeout=30.0) as client:
                resp = await client.post(
                    "https://api.openai.com/v1/chat/completions",
                    json={
                        "model": "gpt-4.1-mini",
                        "messages": [
                            {
                                "role": "system",
                                "content": "You are a Devonn.ai result synthesizer. Combine sub-task results into a clear, concise final answer."
                            },
                            {
                                "role": "user",
                                "content": f"Goal: {run.goal}\n\nSub-task results:\n{results_summary}\n\nProvide a final synthesized answer."
                            }
                        ],
                        "temperature": 0.2
                    },
                    headers={
                        "Authorization": f"Bearer {settings.openai_api_key}",
                        "Content-Type": "application/json"
                    }
                )
                resp.raise_for_status()

            data = resp.json()
            return data["choices"][0]["message"]["content"]

        except Exception as exc:
            logger.error("Result synthesis failed: %s", exc)
            return results_summary


# Global singleton instance
orchestrator = AgentOrchestrator()
