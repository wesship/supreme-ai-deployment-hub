from __future__ import annotations

from typing import Any

import pytest

from backend.ai_films.hermes_mastering_bridge import HermesMasteringDispatcher
from backend.ai_films.hermes_mastering_handoff_worker import (
    process_handoff_job,
    run_hermes_mastering_handoff_worker,
)


class FakeRepository:
    configured = True

    def __init__(self) -> None:
        self.created: list[tuple[str, dict[str, Any]]] = []
        self.existing_jobs: list[dict[str, Any]] = []
        self.source_exists = True

    async def list_rows(self, table: str, params: dict[str, Any]) -> list[dict[str, Any]]:
        if table == "ai_film_render_jobs":
            return list(self.existing_jobs)
        if table == "ai_film_projects":
            return [{"id": "project-1", "owner_id": "owner-1"}]
        if table == "ai_film_assets":
            return [{"id": "asset-1"}] if self.source_exists else []
        return []

    async def create_row(self, table: str, payload: dict[str, Any]) -> dict[str, Any]:
        self.created.append((table, payload))
        return {"id": "render-1", **payload}


class FakeFallback:
    configured = True

    def __init__(self) -> None:
        self.calls: list[dict[str, Any]] = []

    async def dispatch(self, **kwargs: Any) -> dict[str, Any]:
        self.calls.append(kwargs)
        return {"status": "fallback"}


@pytest.mark.asyncio
async def test_mastering_dispatch_queues_one_owner_scoped_render_job() -> None:
    repository = FakeRepository()
    fallback = FakeFallback()
    dispatcher = HermesMasteringDispatcher(repository, fallback)

    result = await dispatcher.dispatch(
        task_id="hermes-task-1",
        agent_name="ai-films-mastering",
        idempotency_key="idem-1",
        input_data={
            "project_id": "project-1",
            "shot_id": "shot-1",
            "film_node": {
                "shot_id": "shot-1",
                "inputs": {"source_asset_id": "asset-1", "start_timecode": "01:00:00:00"},
            },
            "_hermes": {"execution_id": "execution-1"},
        },
    )

    assert result["render_job_id"] == "render-1"
    assert result["completion_condition"] == "master_qa_passed"
    assert fallback.calls == []
    assert len(repository.created) == 1
    table, payload = repository.created[0]
    assert table == "ai_film_render_jobs"
    assert payload["owner_id"] == "owner-1"
    assert payload["input"]["source_asset_id"] == "asset-1"
    assert payload["input"]["hermes_task_id"] == "hermes-task-1"
    assert payload["input"]["hermes_idempotency_key"] == "idem-1"


@pytest.mark.asyncio
async def test_mastering_dispatch_reuses_existing_render_job() -> None:
    repository = FakeRepository()
    repository.existing_jobs = [{"id": "render-existing"}]
    dispatcher = HermesMasteringDispatcher(repository, FakeFallback())

    result = await dispatcher.dispatch(
        task_id="hermes-task-1",
        agent_name="ai-films-mastering",
        input_data={"project_id": "project-1", "shot_id": "shot-1", "source_asset_id": "asset-1"},
        idempotency_key="idem-1",
    )

    assert result["render_job_id"] == "render-existing"
    assert result["reused"] is True
    assert repository.created == []


@pytest.mark.asyncio
async def test_mastering_dispatch_rejects_cross_owner_or_missing_source() -> None:
    repository = FakeRepository()
    repository.source_exists = False
    dispatcher = HermesMasteringDispatcher(repository, FakeFallback())

    with pytest.raises(ValueError, match="owner/project isolation"):
        await dispatcher.dispatch(
            task_id="hermes-task-1",
            agent_name="ai-films-mastering",
            input_data={"project_id": "project-1", "shot_id": "shot-1", "source_asset_id": "asset-x"},
        )


@pytest.mark.asyncio
async def test_non_mastering_agent_uses_existing_dispatcher() -> None:
    repository = FakeRepository()
    fallback = FakeFallback()
    dispatcher = HermesMasteringDispatcher(repository, fallback)

    result = await dispatcher.dispatch(
        task_id="task-2",
        agent_name="TARS",
        input_data={"hello": "world"},
    )

    assert result == {"status": "fallback"}
    assert len(fallback.calls) == 1
    assert repository.created == []


class FakeAssemblyDb:
    def __init__(self) -> None:
        self.updates: list[tuple[str, dict[str, Any]]] = []

    async def update_job(self, job_id: str, patch: dict[str, Any]) -> None:
        self.updates.append((job_id, patch))


@pytest.mark.asyncio
async def test_handoff_worker_records_completed_binding(monkeypatch: pytest.MonkeyPatch) -> None:
    async def fake_finalize(job: dict[str, Any], *, passed: bool, certification: dict[str, Any]) -> bool:
        assert passed is True
        assert certification == {"passed": True}
        return True

    monkeypatch.setattr(
        "backend.ai_films.hermes_mastering_handoff_worker.finalize_hermes_mastering_task",
        fake_finalize,
    )
    db = FakeAssemblyDb()
    job = {
        "id": "render-1",
        "input": {"hermes_task_id": "task-1"},
        "output": {"qa": {"state": "master_qa_passed", "certification": {"passed": True}}},
    }

    assert await process_handoff_job(job, db) is True
    assert db.updates[-1][1]["output"]["qa"]["hermes_handoff_state"] == "completed"


@pytest.mark.asyncio
async def test_handoff_worker_is_production_gated() -> None:
    await run_hermes_mastering_handoff_worker(
        environ={"RAILWAY_ENVIRONMENT_NAME": "staging"},
        once=True,
    )
