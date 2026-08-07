from __future__ import annotations

import pytest

from backend.ai_films import jockey_startup_canary as canary


@pytest.mark.asyncio
async def test_jockey_startup_canary_persists_pass_without_content(monkeypatch):
    updates = []

    class FakeDB:
        def __init__(self, environ=None):
            pass

        async def get_project(self, project_id):
            return {"id": project_id, "metadata": {}}

        async def update_project_metadata(self, values, project_id=canary.PROJECT_ID):
            updates.append(dict(values))

    class FakeClient:
        def __init__(self, environ=None):
            pass

        async def reason(self, message, **kwargs):
            assert "do not" in message.lower()
            return {"id": "resp_123", "output": "film content that must not be persisted"}

    monkeypatch.setattr(canary, "SupabaseFilmBootstrapClient", FakeDB)
    monkeypatch.setattr(canary, "TwelveLabsClient", FakeClient)

    result = await canary.certify_jockey_on_startup(
        {"RAILWAY_ENVIRONMENT_NAME": "production"}
    )

    assert result["status"] == "passed"
    assert result["response_received"] is True
    assert result["response_id"] == "resp_123"
    assert any(update.get("jockey_canary_state") == "passed" for update in updates)
    persisted = " ".join(str(update) for update in updates)
    assert "film content that must not be persisted" not in persisted


@pytest.mark.asyncio
async def test_jockey_startup_canary_skips_after_pass(monkeypatch):
    class FakeDB:
        def __init__(self, environ=None):
            pass

        async def get_project(self, project_id):
            return {"id": project_id, "metadata": {"jockey_canary_state": "passed"}}

    monkeypatch.setattr(canary, "SupabaseFilmBootstrapClient", FakeDB)

    result = await canary.certify_jockey_on_startup(
        {"RAILWAY_ENVIRONMENT_NAME": "production"}
    )
    assert result == {"status": "passed", "reason": "already_certified"}
