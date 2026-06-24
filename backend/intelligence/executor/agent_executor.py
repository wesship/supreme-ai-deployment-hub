"""
Devonn.ai Agent Executor

Autonomous task execution loop. Given a task description, the executor
uses the LLM to reason, select tools, execute them, and iterate until
the task is complete or a step limit is reached.
"""
from __future__ import annotations

import json
import logging
import time
import uuid
from typing import Any, Dict, List, Optional

import httpx
from pydantic import BaseModel, Field

from backend.app.config import get_settings
from intelligence.prompts.engine import prompt_engine

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

    def register_tool(self, name: str, handler) -> None:
        """Register a callable tool handler."""
        self._tool_handlers[name] = handler

    async def execute(self, task: str, context: Dict[str, Any] = None) -> AgentResult:
        """Execute a task autonomously."""
        settings = get_settings()
        result = AgentResult(task=task)
        context = context or {}

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
                # Get next action from LLM
                async with httpx.AsyncClient(timeout=60.0) as client:
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
                observation = await self._execute_action(action, action_input)
                step.observation = observation
                result.steps.append(step)

                # Add to message history
                messages.append({"role": "assistant", "content": json.dumps(content)})
                messages.append({"role": "user", "content": f"Observation: {observation}"})

            except Exception as exc:
                logger.exception("Agent step %d failed: %s", step_num, exc)
                result.status = "failed"
                result.error = str(exc)
                break
        else:
            result.status = "max_steps_reached"
            result.error = f"Reached maximum step limit of {MAX_STEPS}"

        result.completed_at = time.time()
        return result

    async def _execute_action(self, action: str, action_input: Dict[str, Any]) -> str:
        """Execute a tool action and return the observation string."""
        handler = self._tool_handlers.get(action)
        if handler is None:
            return f"Error: Unknown tool '{action}'. Available tools: {list(self._tool_handlers.keys())}"
        try:
            result = await handler(**action_input)
            return str(result)
        except Exception as exc:
            return f"Tool error: {exc}"

    def _build_system_prompt(self, context: Dict[str, Any]) -> str:
        """Build the system prompt for the agent."""
        tool_list = "\n".join([f"- {name}" for name in self._tool_handlers.keys()]) or "- none"
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
