from __future__ import annotations

import asyncio
from typing import Any, Mapping

import pytest
from fastapi import FastAPI

from backend.ai_films.mastering_recovery_worker import (
    recover_stale_states,
    run_mastering_recovery_worker,
)
from backend.app.routers import _task_state


class FakeRecoveryDb:
    def __init__(self) -> None:
        self.patch_calls: list[tuple[dict[str, str], dict[str, Any]]] = []

    async def _request(
        self,
        method: str,
        table: str,
        *,
        params: Mapping[str, str] | None = None,
        payload: Mapping[str, Any] | None = None,
        representation: bool = False,
    ) -> list[dict[str, Any]]:
        assert table == "ai_film_render_jobs"
        query = dict(params or {})
        if method == "GET" and query.get("status") == "eq.processing":
            return [
                {
                    "id": "processing-requeue",
                    "attempt_count": 1,
                    "output": {},
                },
                {
                    "id": "processing-fail",
                    "attempt_count": 3,
                    "output": {},
                },
            ]
        if method == "GET" and query.get("status") == "eq.completed":
            return [
                {
                    "id": "qc-stale",
                    "output": {"qa": {"state": "master_qa_in_progress"}},
                },
                {
                    "id": "handoff-stale",
                    "output": {
                        "qa": {
                            "state": "master_qa_passed",
                            "hermes_handoff_state": "in_progress",
                        }
                    },
                },
            ]
        if method == "PATCH":
            self.patch_calls.append((query, dict(payload or {})))
            return [{"id": query.get("id", "unknown")}]
        return []


@pytest.mark.asyncio
async def test_recovery_covers_mastering_qc_and_handoff_with_cas_filters() -> None:
    db = FakeRecoveryDb()

    counts = await recover_stale_states(
        db,  # type: ignore[arg-type]
        stale_seconds=7200,
        max_mastering_attempts=3,
    )

    assert counts == {
        "mastering_requeued": 1,
        "mastering_failed": 1,
        "qc_requeued": 1,
        "handoff_retried": 1,
    }
    assert len(db.patch_calls) == 4

    by_id = {params["id"]: (params, payload) for params, payload in db.patch_calls}
    requeue_params, requeue_payload = by_id["eq.processing-requeue"]
    assert requeue_params["status"] == "eq.processing"
    assert requeue_params["updated_at"].startswith("lt.")
    assert requeue_payload["status"] == "queued"
    assert requeue_payload["started_at"] is None

    fail_params, fail_payload = by_id["eq.processing-fail"]
    assert fail_params["status"] == "eq.processing"
    assert fail_payload["status"] == "failed"
    assert "attempt limit" in fail_payload["error_message"]

    qc_params, qc_payload = by_id["eq.qc-stale"]
    assert qc_params["output->qa->>state"] == "eq.master_qa_in_progress"
    assert qc_payload["output"]["qa"]["state"] == "pending_master_qa"

    handoff_params, handoff_payload = by_id["eq.handoff-stale"]
    assert handoff_params["output->qa->>hermes_handoff_state"] == "eq.in_progress"
    assert handoff_payload["output"]["qa"]["hermes_handoff_state"] == "retry"


class LostRaceDb(FakeRecoveryDb):
    async def _request(
        self,
        method: str,
        table: str,
        *,
        params: Mapping[str, str] | None = None,
        payload: Mapping[str, Any] | None = None,
        representation: bool = False,
    ) -> list[dict[str, Any]]:
        if method == "PATCH":
            self.patch_calls.append((dict(params or {}), dict(payload or {})))
            return []
        return await super()._request(
            method,
            table,
            params=params,
            payload=payload,
            representation=representation,
        )


@pytest.mark.asyncio
async def test_recovery_does_not_count_compare_and_set_race_losses() -> None:
    db = LostRaceDb()
    counts = await recover_stale_states(db, stale_seconds=7200)  # type: ignore[arg-type]
    assert counts == {
        "mastering_requeued": 0,
        "mastering_failed": 0,
        "qc_requeued": 0,
        "handoff_retried": 0,
    }


@pytest.mark.asyncio
async def test_recovery_worker_is_production_gated() -> None:
    await run_mastering_recovery_worker(
        environ={"RAILWAY_ENVIRONMENT_NAME": "staging"},
        once=True,
    )


@pytest.mark.asyncio
async def test_task_state_reports_running_and_terminal_tasks() -> None:
    app = FastAPI()
    running = asyncio.create_task(asyncio.sleep(60))
    app.state.worker = running
    assert _task_state(app, "worker") == "running"
    running.cancel()
    with pytest.raises(asyncio.CancelledError):
        await running
    assert _task_state(app, "worker") == "cancelled"
    assert _task_state(app, "missing") == "unavailable"

    async def succeed() -> None:
        return None

    stopped = asyncio.create_task(succeed())
    await stopped
    app.state.worker = stopped
    assert _task_state(app, "worker") == "stopped"
