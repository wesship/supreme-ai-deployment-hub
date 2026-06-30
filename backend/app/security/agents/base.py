"""
backend/app/security/agents/base.py — Base class for all D3VONN Security Agents

All agents in the workforce inherit from BaseSecurityAgent and implement:
- analyze(): Process input data and produce findings
- act(): Execute automated response actions
- report(): Generate structured output for the dashboard/knowledge graph

TODO: Replace stub implementations with OpenAI/Hermes-powered reasoning.
"""

from __future__ import annotations

import logging
from abc import ABC, abstractmethod
from dataclasses import dataclass, field
from datetime import datetime, timezone
from typing import Any, Optional

logger = logging.getLogger(__name__)


@dataclass
class AgentTask:
    """A task assigned to a security agent."""
    task_id: str
    task_type: str
    priority: int = 5
    input_data: dict[str, Any] = field(default_factory=dict)
    context: dict[str, Any] = field(default_factory=dict)
    created_at: datetime = field(default_factory=lambda: datetime.now(timezone.utc))


@dataclass
class AgentResult:
    """Result produced by a security agent."""
    agent_id: str
    task_id: str
    status: str = "completed"  # completed | failed | escalated
    findings: list[dict[str, Any]] = field(default_factory=list)
    actions_taken: list[dict[str, Any]] = field(default_factory=list)
    recommendations: list[str] = field(default_factory=list)
    confidence: int = 50  # 0-100
    metadata: dict[str, Any] = field(default_factory=dict)
    completed_at: datetime = field(default_factory=lambda: datetime.now(timezone.utc))


class BaseSecurityAgent(ABC):
    """
    Abstract base class for D3VONN Security Agents.

    Each agent has:
    - An ID matching the security_agent_workforce table
    - Capabilities defining what it can do
    - Methods for analysis, action, and reporting
    """

    agent_id: str = "base"
    name: str = "Base Agent"
    description: str = ""
    capabilities: list[str] = []

    def __init__(self, supabase_client: Any):
        self.db = supabase_client
        self.logger = logging.getLogger(f"d3vonn.agent.{self.agent_id}")

    async def execute(self, task: AgentTask) -> AgentResult:
        """
        Main execution entry point. Orchestrates analyze → act → report.
        """
        self.logger.info(
            "Agent '%s' executing task: %s (type=%s, priority=%d)",
            self.agent_id, task.task_id, task.task_type, task.priority,
        )

        try:
            # Update agent status
            await self._update_status("busy", task.task_type)

            # Core workflow
            findings = await self.analyze(task)
            actions = await self.act(task, findings)
            result = await self.report(task, findings, actions)

            # Record task completion
            await self._record_task(task, result)
            await self._update_status("active")

            return result

        except Exception as exc:
            self.logger.error("Agent '%s' failed on task %s: %s", self.agent_id, task.task_id, exc)
            await self._update_status("error")
            return AgentResult(
                agent_id=self.agent_id,
                task_id=task.task_id,
                status="failed",
                metadata={"error": str(exc)},
            )

    @abstractmethod
    async def analyze(self, task: AgentTask) -> list[dict[str, Any]]:
        """Analyze input data and produce findings."""
        ...

    @abstractmethod
    async def act(self, task: AgentTask, findings: list[dict[str, Any]]) -> list[dict[str, Any]]:
        """Execute automated actions based on findings."""
        ...

    @abstractmethod
    async def report(
        self, task: AgentTask, findings: list[dict[str, Any]], actions: list[dict[str, Any]]
    ) -> AgentResult:
        """Generate structured result."""
        ...

    async def _update_status(self, status: str, current_task: Optional[str] = None):
        """Update agent status in the workforce table."""
        try:
            update_data: dict[str, Any] = {
                "status": status,
                "last_heartbeat": datetime.now(timezone.utc).isoformat(),
            }
            if current_task:
                update_data["current_task"] = current_task
            elif status in ("active", "idle"):
                update_data["current_task"] = None

            self.db.table("security_agent_workforce").update(update_data).eq("id", self.agent_id).execute()
        except Exception as exc:
            self.logger.warning("Failed to update agent status: %s", exc)

    async def _record_task(self, task: AgentTask, result: AgentResult):
        """Record task execution in the agent_tasks table."""
        try:
            self.db.table("security_agent_tasks").insert({
                "agent_id": self.agent_id,
                "task_type": task.task_type,
                "priority": task.priority,
                "status": result.status if result.status != "escalated" else "completed",
                "input_data": task.input_data,
                "output_data": {
                    "findings_count": len(result.findings),
                    "actions_count": len(result.actions_taken),
                    "confidence": result.confidence,
                },
                "started_at": task.created_at.isoformat(),
                "completed_at": result.completed_at.isoformat(),
            }).execute()
        except Exception as exc:
            self.logger.warning("Failed to record task: %s", exc)
