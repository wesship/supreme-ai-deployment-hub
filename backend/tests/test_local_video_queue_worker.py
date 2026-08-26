import pytest

from backend.ai_films.local_video_queue_worker import claim_next_local_video_job, run_once


class FakeDB:
    def __init__(self):
        self.requests = []

    async def _request(self, method, table, *, params=None, payload=None, representation=False):
        self.requests.append((method, table, params, payload, representation))
        if method == "GET":
            return [{"id": "job-1", "provider": "wan", "project_id": "project-1", "input": {"generation_packet": {"shot_id": "shot-1"}}}]
        return [{"id": "job-1", "provider": "wan", "project_id": "project-1", "input": {"generation_packet": {"shot_id": "shot-1"}}}]


@pytest.mark.asyncio
async def test_claims_only_queued_local_video_jobs():
    db = FakeDB()
    job = await claim_next_local_video_job(db)
    assert job["id"] == "job-1"
    assert db.requests[0][2]["job_type"] == "eq.video"
    assert db.requests[0][2]["provider"] == "in.(wan,ltx)"
    assert db.requests[1][2]["status"] == "eq.queued"


@pytest.mark.asyncio
async def test_run_once_is_disabled_without_execution_flag():
    result = await run_once({"AI_FILM_GENERATION_EXECUTION_ENABLED": "false"})
    assert result == {"status": "disabled"}
