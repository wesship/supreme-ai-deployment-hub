from __future__ import annotations

from dataclasses import dataclass
from types import SimpleNamespace
from typing import Any

import pytest

from backend.hermes.prompt_dispatcher import PromptAwareDispatcher


class FakeRepository:
    def __init__(self) -> None:
        self.task = {
            "id": "task-1",
            "task_type": "pool-risk-analysis",
            "input_data": {"asset": "ETH"},
        }
        self.updates: list[dict[str, Any]] = []
        self.logs: list[dict[str, Any]] = []

    async def list_rows(self, table: str, params: dict[str, Any]) -> list[dict[str, Any]]:
        assert table == "hermes_tasks"
        return [dict(self.task)]

    async def update_row(self, table: str, row_id: str, payload: dict[str, Any]) -> dict[str, Any]:
        assert table == "hermes_tasks"
        assert row_id == "task-1"
        self.updates.append(payload)
        self.task.update(payload)
        return dict(self.task)

    async def create_row(self, table: str, payload: dict[str, Any]) -> dict[str, Any]:
        assert table == "hermes_logs"
        self.logs.append(payload)
        return payload


class FakeDownstream:
    configured = True

    def __init__(self) -> None:
        self.calls: list[dict[str, Any]] = []

    async def dispatch(self, **kwargs: Any) -> dict[str, Any]:
        self.calls.append(kwargs)
        return {"status": "queued"}


@dataclass
class FakeRegistry:
    resolved: Any = None
    error: Exception | None = None

    async def resolve(self, **kwargs: Any) -> Any:
        if self.error:
            raise self.error
        return self.resolved


@pytest.mark.asyncio
async def test_approved_prompt_is_supplemental_and_provenance_is_persisted() -> None:
    repository = FakeRepository()
    downstream = FakeDownstream()
    resolved = SimpleNamespace(
        prompt_id="prompt-1",
        version_id="version-7",
        slug="liquidity.pool-risk",
        source="prompts_chat",
        scope="task",
        content="Analyze pool risk using the approved rubric.",
        variables={"network": "ethereum"},
        checksum="abc123",
        risk_score=0.12,
        quality_score=0.91,
    )
    dispatcher = PromptAwareDispatcher(
        repository,
        downstream,
        prompt_registry=FakeRegistry(resolved=resolved),
    )

    result = await dispatcher.dispatch(
        task_id="task-1",
        agent_name="ION",
        input_data={"asset": "ETH"},
        idempotency_key="idem-1",
    )

    assert result == {"status": "queued"}
    sent = downstream.calls[0]["input_data"]
    runtime = sent["_hermes"]["runtime_prompt"]
    assert runtime["authority"] == "supplemental"
    assert runtime["content"] == resolved.content
    assert runtime["provenance"]["prompt_version_id"] == "version-7"
    assert repository.updates[0]["input_data"] == sent
    assert repository.logs[0]["event"] == "prompt.resolved"
    assert repository.logs[0]["data"]["checksum"] == "abc123"


@pytest.mark.asyncio
async def test_missing_prompt_passes_through_without_runtime_prompt() -> None:
    repository = FakeRepository()
    downstream = FakeDownstream()
    dispatcher = PromptAwareDispatcher(
        repository,
        downstream,
        prompt_registry=FakeRegistry(resolved=None),
    )

    await dispatcher.dispatch(
        task_id="task-1",
        agent_name="ION",
        input_data={"asset": "ETH"},
    )

    sent = downstream.calls[0]["input_data"]
    assert "_hermes" not in sent
    assert repository.updates == []
    assert repository.logs == []


@pytest.mark.asyncio
async def test_registry_failure_never_injects_unverified_fallback() -> None:
    repository = FakeRepository()
    downstream = FakeDownstream()
    dispatcher = PromptAwareDispatcher(
        repository,
        downstream,
        prompt_registry=FakeRegistry(error=RuntimeError("registry unavailable")),
    )

    await dispatcher.dispatch(
        task_id="task-1",
        agent_name="ION",
        input_data={"asset": "ETH"},
    )

    sent = downstream.calls[0]["input_data"]
    assert "runtime_prompt" not in sent.get("_hermes", {})
    assert repository.updates == []
