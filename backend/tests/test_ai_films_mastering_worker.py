from __future__ import annotations

from pathlib import Path

import httpx
import pytest

from backend.ai_films.mastering_worker import (
    MasteringWorkerError,
    _claim_next_job,
    _load_scoped_source_asset,
    run_mastering_worker,
)
from backend.ai_films.assembly_worker import SupabaseAssemblyClient
from backend.ai_films.mastering_router import MasteringQueueRequest


@pytest.mark.asyncio
async def test_claim_mastering_job_uses_exact_job_type_provider_and_status():
    requests: list[httpx.Request] = []

    def handler(request: httpx.Request) -> httpx.Response:
        requests.append(request)
        if request.method == "GET":
            return httpx.Response(
                200,
                json=[
                    {
                        "id": "job-1",
                        "status": "queued",
                        "attempt_count": 0,
                    }
                ],
            )
        if request.method == "PATCH":
            return httpx.Response(
                200,
                json=[
                    {
                        "id": "job-1",
                        "status": "processing",
                        "attempt_count": 1,
                    }
                ],
            )
        raise AssertionError(request.method)

    db = SupabaseAssemblyClient(
        {
            "SUPABASE_URL": "https://example.supabase.co",
            "SUPABASE_SERVICE_ROLE_KEY": "test-service-role",
        },
        transport=httpx.MockTransport(handler),
    )
    job = await _claim_next_job(db)
    assert job and job["status"] == "processing"
    query = requests[0].url.params
    assert query["job_type"] == "eq.mastering"
    assert query["provider"] == "eq.ffmpeg"
    assert query["status"] == "eq.queued"


@pytest.mark.asyncio
async def test_source_asset_lookup_is_owner_and_project_scoped():
    seen_query: httpx.QueryParams | None = None

    def handler(request: httpx.Request) -> httpx.Response:
        nonlocal seen_query
        seen_query = request.url.params
        return httpx.Response(200, json=[])

    db = SupabaseAssemblyClient(
        {
            "SUPABASE_URL": "https://example.supabase.co",
            "SUPABASE_SERVICE_ROLE_KEY": "test-service-role",
        },
        transport=httpx.MockTransport(handler),
    )
    with pytest.raises(MasteringWorkerError, match="owner/project"):
        await _load_scoped_source_asset(
            db,
            asset_id="asset-1",
            project_id="project-1",
            owner_id="owner-1",
        )
    assert seen_query is not None
    assert seen_query["id"] == "eq.asset-1"
    assert seen_query["project_id"] == "eq.project-1"
    assert seen_query["owner_id"] == "eq.owner-1"


@pytest.mark.asyncio
async def test_mastering_worker_does_not_run_outside_production(monkeypatch):
    class ExplodingClient:
        def __init__(self, *args, **kwargs):
            raise AssertionError("client must not be constructed outside production")

    monkeypatch.setattr("backend.ai_films.mastering_worker.SupabaseAssemblyClient", ExplodingClient)
    await run_mastering_worker(
        environ={
            "RAILWAY_ENVIRONMENT_NAME": "staging",
            "SUPABASE_URL": "https://example.supabase.co",
            "SUPABASE_SERVICE_ROLE_KEY": "secret",
        },
        once=True,
    )


def test_mastering_queue_request_validates_smpte_timecode():
    request = MasteringQueueRequest(
        project_id="project-1",
        source_asset_id="asset-1",
        shot_id="shot-1",
        start_timecode="01:00:00;00",
    )
    assert request.start_timecode == "01:00:00;00"
    with pytest.raises(ValueError):
        MasteringQueueRequest(
            project_id="project-1",
            source_asset_id="asset-1",
            shot_id="shot-1",
            start_timecode="1:00:00",
        )
