"""
Devonn.ai Agent Executor

Autonomous task execution loop. Given a task description, the executor
uses the LLM to reason, select tools, execute them, and iterate until
the task is complete or a step limit is reached.
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
from .safety_policy import (
    ApprovalMode,
    ToolPolicy,
    ToolRisk,
    evaluate_tool_action,
    redact_sensitive_text,
    remaining_runtime_seconds,
    validate_agent_budget,
)
from ..prompts.engine import prompt_engine

logger = logging.getLogger(__name__)

MAX_STEPS = 10  # Safety limit for autonomous loops


class ExecutionStep(BaseModel):
    step_number: int
    thought: str
    action: str
    action_input: Dict[str, Any] = Field(default_factory=dict)
    observation: Optional[str] = None


class AgentResult(BaseModel):
    run_id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    task: str
    status: str = "pending"  # "pending" | "success" | "failed" | "max_steps_reached"
    final_answer: Optional[str] = None
    steps: List[ExecutionStep] = Field(default_factory=list)
    started_at: float = Field(default_factory=time.time)
    completed_at: Optional[float] = None
    error: Optional[str] = None


class AgentExecutor:
    """
    ReAct-style agent executor.
    Loops: Thought → Action → Observation → Thought → ...
    until the agent outputs FINISH or MAX_STEPS is reached.
    """

    def __init__(self):
        self._tool_handlers: Dict[str, Any] = {}
        self._tool_policies: Dict[str, ToolPolicy] = {}

    def register_tool(
        self,
        name: str,
        handler,
        *,
        risk_tier: Optional[ToolRisk] = None,
    ) -> None:
        """Register a handler; unclassified tools remain fail-closed."""
        self._tool_handlers[name] = handler
        if risk_tier is None:
            self._tool_policies.pop(name, None)
        else:
            self._tool_policies[name] = ToolPolicy(risk=risk_tier)

    async def execute(self, task: str, context: Dict[str, Any] = None) -> AgentResult:
        """Execute a task autonomously."""
        settings = get_settings()
        result = AgentResult(task=task)
        context = context or {}
        started_at = time.monotonic()
        tool_calls = 0

        messages = [
            {
                "role": "system",
                "content": self._build_system_prompt(context)
            },
            {
                "role": "user",
                "content": f"Task: {task}"
            }
        ]

        for step_num in range(1, MAX_STEPS + 1):
            try:
                budget = validate_agent_budget(
                    active_agents=1,
                    depth=1,
                    tool_calls=tool_calls,
                    started_at=started_at,
                )
                if budget.mode is ApprovalMode.DENY:
                    raise RuntimeError(budget.reason)

                # Get next action from LLM
                request_timeout = min(60.0, remaining_runtime_seconds(started_at))
                if request_timeout <= 0:
                    raise RuntimeError("Maximum autonomous runtime exceeded.")
                async with httpx.AsyncClient(timeout=request_timeout) as client:
                    resp = await client.post(
                        "https://api.openai.com/v1/chat/completions",
                        json={
                            "model": "gpt-4.1-mini",
                            "messages": messages,
                            "response_format": {"type": "json_object"},
                            "temperature": 0.2
                        },
                        headers={
                            "Authorization": f"Bearer {settings.openai_api_key}",
                            "Content-Type": "application/json"
                        }
                    )

                if resp.status_code != 200:
                    raise RuntimeError(f"OpenAI error {resp.status_code}: {resp.text[:200]}")

                data = resp.json()
                content = json.loads(data["choices"][0]["message"]["content"])

                thought = content.get("thought", "")
                action = content.get("action", "FINISH")
                action_input = content.get("action_input", {})
                final_answer = content.get("final_answer")

                step = ExecutionStep(
                    step_number=step_num,
                    thought=thought,
                    action=action,
                    action_input=action_input
                )

                if action == "FINISH":
                    result.final_answer = final_answer or thought
                    result.status = "success"
                    step.observation = "Task completed."
                    result.steps.append(step)
                    break

                # Execute the tool
                observation, executed = await self._execute_action(
                    action,
                    action_input,
                    started_at=started_at,
                )
                tool_calls += int(executed)
                step.observation = observation
                result.steps.append(step)

                # Add to message history
                messages.append({"role": "assistant", "content": json.dumps(content)})
                messages.append({"role": "user", "content": f"Observation: {observation}"})

            except Exception as exc:
                logger.exception("Agent step %d failed: %s", step_num, exc)
                result.status = "failed"
                result.error = redact_sensitive_text(str(exc))
                break
        else:
            result.status = "max_steps_reached"
            result.error = f"Reached maximum step limit of {MAX_STEPS}"

        result.completed_at = time.time()
        return result

    async def _execute_action(
        self,
        action: str,
        action_input: Dict[str, Any],
        *,
        started_at: Optional[float] = None,
    ) -> tuple[str, bool]:
        """Policy-check a tool action and return its observation and execution state."""
        handler = self._tool_handlers.get(action)
        if handler is None:
            return f"Denied: unknown tool '{action}'.", False

        decision = evaluate_tool_action(action, action_input, self._tool_policies)
        if decision.mode is ApprovalMode.DENY:
            return f"Denied: {decision.reason}", False
        if decision.mode is ApprovalMode.APPROVAL_REQUIRED:
            return f"Approval required: {decision.reason}", False

        action_started_at = started_at if started_at is not None else time.monotonic()
        timeout = remaining_runtime_seconds(action_started_at)
        if timeout <= 0:
            return "Denied: Maximum autonomous runtime exceeded.", False
        try:
            result = await asyncio.wait_for(handler(**action_input), timeout=timeout)
            return redact_sensitive_text(str(result)), True
        except TimeoutError:
            return "Tool error: autonomous runtime limit exceeded.", True
        except Exception as exc:
            return f"Tool error: {redact_sensitive_text(str(exc))}", True

    def _build_system_prompt(self, context: Dict[str, Any]) -> str:
        """Build the system prompt for the agent."""
        tool_list = "\n".join([f"- {name}" for name in self._tool_policies]) or "- none"
        ctx_str = json.dumps(context, indent=2) if context else "{}"
        return f"""You are a Devonn.ai autonomous agent.
You execute tasks step by step using available tools.

Available tools:
{tool_list}

Context:
{ctx_str}

At each step, output a JSON object with:
- "thought": your reasoning
- "action": the tool to use (or "FINISH" when done)
- "action_input": dict of arguments for the tool
- "final_answer": (only when action is "FINISH") the final result

Always reason before acting. Be concise and precise.
"""


# Global singleton instance
agent_executor = AgentExecutor()
