"""
agent_mesh.py — D3VONN Multi-Agent Mesh Communication Layer

Implements a lightweight REST-based agent mesh that allows the supreme-ai-deployment-hub
to coordinate with external agent services (d3vonn-coordinator, openclaw-bridge).

Architecture:
  - AgentMesh: central registry and dispatcher
  - AgentClient: async HTTP client for a single agent service
  - AgentTask: structured task payload with retry logic
  - AgentResult: typed response from an agent

This replaces the empty scaffold stubs in scaffold/d3vonn-coordinator and
scaffold/openclaw-bridge with a working communication layer.
"""

from __future__ import annotations

import asyncio
import logging
import time
import uuid
from dataclasses import dataclass, field
from enum import Enum
from typing import Any

import httpx
from pydantic import BaseModel, Field

logger = logging.getLogger(__name__)

# ── Enums ─────────────────────────────────────────────────────────────────────

class AgentStatus(str, Enum):
    IDLE = "idle"
    BUSY = "busy"
    ERROR = "error"
    OFFLINE = "offline"


class TaskPriority(str, Enum):
    LOW = "low"
    NORMAL = "normal"
    HIGH = "high"
    CRITICAL = "critical"


# ── Data Models ───────────────────────────────────────────────────────────────

class AgentTask(BaseModel):
    task_id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    agent_name: str
    action: str
    payload: dict[str, Any] = Field(default_factory=dict)
    priority: TaskPriority = TaskPriority.NORMAL
    timeout_seconds: int = 30
    max_retries: int = 3
    created_at: float = Field(default_factory=time.time)


class AgentResult(BaseModel):
    task_id: str
    agent_name: str
    success: bool
    data: dict[str, Any] = Field(default_factory=dict)
    error: str | None = None
    duration_ms: float = 0.0
    retries_used: int = 0


class AgentRegistration(BaseModel):
    name: str
    base_url: str
    capabilities: list[str] = Field(default_factory=list)
    health_endpoint: str = "/health"
    api_key_env: str | None = None


# ── Agent Client ──────────────────────────────────────────────────────────────

class AgentClient:
    """Async HTTP client for a single registered agent service."""

    def __init__(self, registration: AgentRegistration, api_key: str | None = None):
        self.reg = registration
        self._api_key = api_key
        self._client = httpx.AsyncClient(
            base_url=registration.base_url,
            timeout=60.0,
            headers=self._build_headers(),
        )
        self.status = AgentStatus.IDLE

    def _build_headers(self) -> dict[str, str]:
        headers = {"Content-Type": "application/json", "X-Agent-Source": "d3vonn-hub"}
        if self._api_key:
            headers["Authorization"] = f"Bearer {self._api_key}"
        return headers

    async def health_check(self) -> bool:
        try:
            response = await self._client.get(
                self.reg.health_endpoint, timeout=5.0
            )
            self.status = AgentStatus.IDLE if response.is_success else AgentStatus.ERROR
            return response.is_success
        except Exception as exc:
            logger.warning("Health check failed for %s: %s", self.reg.name, exc)
            self.status = AgentStatus.OFFLINE
            return False

    async def execute(self, task: AgentTask) -> AgentResult:
        start = time.perf_counter()
        retries = 0
        last_error: str | None = None

        while retries <= task.max_retries:
            try:
                self.status = AgentStatus.BUSY
                response = await self._client.post(
                    f"/tasks/{task.action}",
                    json=task.payload,
                    timeout=task.timeout_seconds,
                    headers={"X-Task-ID": task.task_id},
                )
                response.raise_for_status()
                self.status = AgentStatus.IDLE
                return AgentResult(
                    task_id=task.task_id,
                    agent_name=task.agent_name,
                    success=True,
                    data=response.json(),
                    duration_ms=(time.perf_counter() - start) * 1000,
                    retries_used=retries,
                )
            except httpx.HTTPStatusError as exc:
                last_error = f"HTTP {exc.response.status_code}: {exc.response.text[:200]}"
                logger.warning(
                    "Task %s attempt %d failed for %s: %s",
                    task.task_id, retries + 1, task.agent_name, last_error,
                )
                if exc.response.status_code < 500:
                    break  # Client errors are not retryable
            except (httpx.RequestError, asyncio.TimeoutError) as exc:
                last_error = str(exc)
                logger.warning(
                    "Task %s attempt %d network error for %s: %s",
                    task.task_id, retries + 1, task.agent_name, last_error,
                )

            retries += 1
            if retries <= task.max_retries:
                await asyncio.sleep(2 ** retries)  # Exponential backoff

        self.status = AgentStatus.ERROR
        return AgentResult(
            task_id=task.task_id,
            agent_name=task.agent_name,
            success=False,
            error=last_error,
            duration_ms=(time.perf_counter() - start) * 1000,
            retries_used=retries,
        )

    async def close(self) -> None:
        await self._client.aclose()


# ── Agent Mesh ────────────────────────────────────────────────────────────────

class AgentMesh:
    """
    Central registry and dispatcher for the D3VONN multi-agent mesh.

    Usage:
        mesh = AgentMesh()
        mesh.register(AgentRegistration(
            name="d3vonn-coordinator",
            base_url="https://coordinator.d3vonn.io",
            capabilities=["plan", "orchestrate", "summarize"],
        ))
        result = await mesh.dispatch(AgentTask(
            agent_name="d3vonn-coordinator",
            action="plan",
            payload={"goal": "Build a REST API"},
        ))
    """

    def __init__(self):
        self._agents: dict[str, AgentClient] = {}
        self._capability_index: dict[str, list[str]] = {}

    def register(
        self,
        registration: AgentRegistration,
        api_key: str | None = None,
    ) -> None:
        client = AgentClient(registration, api_key)
        self._agents[registration.name] = client
        for cap in registration.capabilities:
            self._capability_index.setdefault(cap, []).append(registration.name)
        logger.info("Registered agent: %s at %s", registration.name, registration.base_url)

    def get_agent(self, name: str) -> AgentClient | None:
        return self._agents.get(name)

    def find_by_capability(self, capability: str) -> list[AgentClient]:
        names = self._capability_index.get(capability, [])
        return [self._agents[n] for n in names if n in self._agents]

    async def dispatch(self, task: AgentTask) -> AgentResult:
        client = self._agents.get(task.agent_name)
        if not client:
            return AgentResult(
                task_id=task.task_id,
                agent_name=task.agent_name,
                success=False,
                error=f"Agent '{task.agent_name}' is not registered in the mesh.",
            )
        return await client.execute(task)

    async def dispatch_to_capable(
        self, capability: str, action: str, payload: dict[str, Any]
    ) -> AgentResult:
        """Dispatch to the first healthy agent with the given capability."""
        candidates = self.find_by_capability(capability)
        for client in candidates:
            if await client.health_check():
                task = AgentTask(
                    agent_name=client.reg.name,
                    action=action,
                    payload=payload,
                )
                return await client.execute(task)
        return AgentResult(
            task_id=str(uuid.uuid4()),
            agent_name="none",
            success=False,
            error=f"No healthy agent found with capability '{capability}'.",
        )

    async def health_check_all(self) -> dict[str, bool]:
        results = await asyncio.gather(
            *[client.health_check() for client in self._agents.values()],
            return_exceptions=True,
        )
        return {
            name: (result is True)
            for name, result in zip(self._agents.keys(), results)
        }

    async def close(self) -> None:
        await asyncio.gather(*[c.close() for c in self._agents.values()])


# ── Default Mesh Instance ─────────────────────────────────────────────────────

import os

def create_default_mesh() -> AgentMesh:
    """
    Creates and configures the default D3VONN agent mesh from environment variables.
    Add these to your .env / GitHub Secrets / Vercel Environment Variables:
      DEVONN_COORDINATOR_URL, DEVONN_COORDINATOR_API_KEY
      OPENCLAW_BRIDGE_URL, OPENCLAW_BRIDGE_API_KEY
    """
    mesh = AgentMesh()

    if coordinator_url := os.getenv("DEVONN_COORDINATOR_URL"):
        mesh.register(
            AgentRegistration(
                name="d3vonn-coordinator",
                base_url=coordinator_url,
                capabilities=["plan", "orchestrate", "summarize", "review"],
            ),
            api_key=os.getenv("DEVONN_COORDINATOR_API_KEY"),
        )

    if openclaw_url := os.getenv("OPENCLAW_BRIDGE_URL"):
        mesh.register(
            AgentRegistration(
                name="openclaw-bridge",
                base_url=openclaw_url,
                capabilities=["code_generate", "code_review", "test_generate"],
            ),
            api_key=os.getenv("OPENCLAW_BRIDGE_API_KEY"),
        )

    return mesh


# Singleton mesh instance for use across the FastAPI app
default_mesh = create_default_mesh()
