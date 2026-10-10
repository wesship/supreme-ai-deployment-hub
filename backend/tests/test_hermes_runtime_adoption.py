"""Regression tests for Hermes v1 contract adoption in the existing runtime."""
from __future__ import annotations

import asyncio
from unittest.mock import AsyncMock

import pytest

from backend.hermes.contracts import RunStatus, TASK_TRANSITIONS, TaskStatus
from backend.hermes.registry import BUILTIN_AGENT_REGISTRY
from backend.hermes import task_engine


def run(coro):
    loop = asyncio.new_event_loop()
    try:
        return loop.run_until_complete(coro)
    finally:
        loop.close()


def test_legacy_task_state_exports_project_canonical_contracts():
    assert task_engine.TASK_STATES == {status.value for status in TaskStatus}
    assert task_engine.VALID_TRANSITIONS == {
        current.value: {target.value for target in targets}
        for current, targets in TASK_TRANSITIONS.items()
    }
    assert "CANCELLED" in task_engine.TASK_STATES


def test_legacy_agent_hierarchy_projects_manifest_registry():
    assert task_engine.AGENT_HIERARCHY == BUILTIN_AGENT_REGISTRY.hierarchy()
    assert task_engine.AGENT_HIERARCHY["HERMES"]["children"] == [
        "TARS",
        "ION",
        "SAPPHIRE",
        "GUARDIAN",
    ]


def test_transition_retry_persists_pending_and_records_requested_status(monkeypatch):
    monkeypatch.setattr(
        task_engine,
        "get_task",
        AsyncMock(return_value={"id": "task-1", "status": "FAILED", "retry_count": 2}),
    )
    patch_row = AsyncMock(return_value={"id": "task-1", "status": "PENDING", "retry_count": 3})
    log_event = AsyncMock(return_value=None)
    monkeypatch.setattr(task_engine, "_sb_patch", patch_row)
    monkeypatch.setattr(task_engine, "log_event", log_event)

    result = run(task_engine.transition_task("task-1", TaskStatus.RETRY))

    assert result["status"] == "PENDING"
    patch = patch_row.await_args.args[2]
    assert patch == {"status": "PENDING", "retry_count": 3}
    event_data = log_event.await_args.kwargs["data"]
    assert event_data["requested_status"] == "RETRY"
    assert event_data["persisted_status"] == "PENDING"


def test_transition_cancelled_sets_completion_timestamp(monkeypatch):
    monkeypatch.setattr(
        task_engine,
        "get_task",
        AsyncMock(return_value={"id": "task-2", "status": "RUNNING", "retry_count": 0}),
    )
    patch_row = AsyncMock(return_value={"id": "task-2", "status": "CANCELLED"})
    monkeypatch.setattr(task_engine, "_sb_patch", patch_row)
    monkeypatch.setattr(task_engine, "log_event", AsyncMock(return_value=None))

    run(task_engine.transition_task("task-2", "CANCELLED"))

    patch = patch_row.await_args.args[2]
    assert patch["status"] == "CANCELLED"
    assert "completed_at" in patch


def test_finish_run_rejects_non_terminal_status(monkeypatch):
    monkeypatch.setattr(task_engine, "_sb_patch", AsyncMock())
    with pytest.raises(ValueError, match="terminal status"):
        run(task_engine.finish_run("run-1", RunStatus.RUNNING))


def test_dispatch_resolves_agent_case_insensitively_without_configuration(monkeypatch):
    monkeypatch.delenv("SUPABASE_URL", raising=False)
    monkeypatch.delenv("HERMES_WEBHOOK_SECRET", raising=False)

    result = run(task_engine.dispatch_to_agent("tArS", "task-3", {"input": "value"}))

    assert result == {"status": "skipped", "reason": "not_configured"}


def test_dispatch_rejects_unknown_agent():
    with pytest.raises(ValueError, match="Unknown agent"):
        run(task_engine.dispatch_to_agent("unknown", "task-4"))
