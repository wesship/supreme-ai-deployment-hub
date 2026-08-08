from __future__ import annotations

import os

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
            self.knowledge_store_id = "stale-store"

        async def reason(self, message, **kwargs):
            assert "do not" in message.lower()
            return {"id": "resp_123", "output": "film content that must not be persisted"}

    async def fake_repair(client, db, metadata):
        client.knowledge_store_id = "ks_repaired"
        os.environ["TWELVELABS_KNOWLEDGE_STORE_ID"] = "ks_repaired"
        return {"_id": "ks_repaired", "name": "Canonical", "item_count": 16}

    monkeypatch.setattr(canary, "SupabaseFilmBootstrapClient", FakeDB)
    monkeypatch.setattr(canary, "TwelveLabsClient", FakeClient)
    monkeypatch.setattr(canary, "ensure_jockey_store_from_index", fake_repair)

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
async def test_jockey_startup_rehydrates_persisted_store_after_pass(monkeypatch):
    updates = []
    monkeypatch.setenv("TWELVELABS_KNOWLEDGE_STORE_ID", "ks_stale_deploy_secret")

    class FakeDB:
        def __init__(self, environ=None):
            pass

        async def get_project(self, project_id):
            return {
                "id": project_id,
                "metadata": {
                    "jockey_canary_state": "passed",
                    "jockey_store_id": "ks_canonical_repaired",
                    "jockey_store_source_index_id": "index_canonical",
                },
            }

        async def update_project_metadata(self, values, project_id=canary.PROJECT_ID):
            updates.append(dict(values))

    class FakeClient:
        def __init__(self, environ=None):
            # The client must see the hydrated canonical value, not the stale one.
            self.knowledge_store_id = os.environ.get("TWELVELABS_KNOWLEDGE_STORE_ID", "")
            assert self.knowledge_store_id == "ks_canonical_repaired"

        async def retrieve_knowledge_store(self):
            return {"_id": self.knowledge_store_id, "name": "Canonical", "item_count": 16}

    monkeypatch.setattr(canary, "SupabaseFilmBootstrapClient", FakeDB)
    monkeypatch.setattr(canary, "TwelveLabsClient", FakeClient)

    result = await canary.certify_jockey_on_startup(
        {"RAILWAY_ENVIRONMENT_NAME": "production"}
    )

    assert result["status"] == "passed"
    assert result["reason"] == "already_certified_runtime_rehydrated"
    assert result["knowledge_store_id"] == "ks_canonical_repaired"
    assert os.environ["TWELVELABS_KNOWLEDGE_STORE_ID"] == "ks_canonical_repaired"
    assert os.environ["TWELVELABS_INDEX_ID"] == "index_canonical"
    assert any(update.get("jockey_runtime_hydrated_at") for update in updates)
