from __future__ import annotations

import pytest

from backend.ai_films import openai_video_worker as worker


@pytest.mark.asyncio
async def test_worker_fails_closed_when_execution_flag_is_disabled(monkeypatch):
    called = False

    class FakeDb:
        pass

    def fake_db(_source):
        nonlocal called
        called = True
        return FakeDb()

    monkeypatch.setattr(worker, "SupabaseAssemblyClient", fake_db)

    await worker.run_openai_video_worker(
        environ={
            "RAILWAY_ENVIRONMENT_NAME": "production",
            "AI_FILM_GENERATION_EXECUTION_ENABLED": "false",
        },
        once=True,
    )

    assert called is False


@pytest.mark.asyncio
async def test_worker_skips_outside_production_even_when_execution_enabled(monkeypatch):
    called = False

    class FakeDb:
        pass

    def fake_db(_source):
        nonlocal called
        called = True
        return FakeDb()

    monkeypatch.setattr(worker, "SupabaseAssemblyClient", fake_db)

    await worker.run_openai_video_worker(
        environ={
            "ENVIRONMENT": "staging",
            "AI_FILM_GENERATION_EXECUTION_ENABLED": "true",
        },
        once=True,
    )

    assert called is False
