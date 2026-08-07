from __future__ import annotations

import pytest

from backend.ai_films import jockey_store_repair as repair
from backend.ai_films.twelvelabs import TwelveLabsError


class FakeDB:
    def __init__(self):
        self.updates = []

    async def update_project_metadata(self, values, project_id=repair.PROJECT_ID):
        self.updates.append(dict(values))


class FakeClient:
    def __init__(self):
        self.knowledge_store_id = "stale-store"
        self.calls = []
        self.created_items = []

    async def retrieve_knowledge_store(self):
        self.calls.append(("retrieve_store", self.knowledge_store_id))
        if self.knowledge_store_id == "stale-store":
            raise TwelveLabsError("TwelveLabs request failed with HTTP 404")
        return {
            "id": self.knowledge_store_id,
            "name": repair.STORE_NAME,
            "item_count": len(self.created_items),
        }

    async def _request(self, method, path, *, payload=None, params=None):
        self.calls.append((method, path, payload, params))
        if method == "GET" and path == "/knowledge-stores":
            return {"data": [], "page_info": {"total_page": 1}}
        if method == "POST" and path == "/knowledge-stores":
            return {"id": "new-store", "name": repair.STORE_NAME}
        if method == "GET" and path.endswith("/indexed-assets"):
            return {
                "data": [
                    {
                        "asset_id": "asset-a",
                        "status": "ready",
                        "system_metadata": {"filename": "a.mp4"},
                    },
                    {
                        "asset_id": "asset-b",
                        "status": "ready",
                        "system_metadata": {"filename": "b.mp4"},
                    },
                ],
                "page_info": {"total_page": 1},
            }
        if method == "GET" and path == "/knowledge-stores/new-store/items":
            return {"data": [], "page_info": {"total_page": 1}}
        if method == "POST" and path == "/knowledge-stores/new-store/items":
            item_id = f"item-{len(self.created_items) + 1}"
            self.created_items.append({"id": item_id, "asset_id": payload["asset_id"]})
            return {"id": item_id}
        if method == "GET" and path.startswith("/knowledge-stores/new-store/items/item-"):
            return {"id": path.rsplit("/", 1)[-1], "status": "ready"}
        raise AssertionError((method, path, payload, params))


@pytest.mark.asyncio
async def test_repair_creates_store_and_reuses_index_assets(monkeypatch):
    client = FakeClient()
    db = FakeDB()
    monkeypatch.delenv("TWELVELABS_KNOWLEDGE_STORE_ID", raising=False)

    store = await repair.ensure_jockey_store_from_index(client, db, {})

    assert store["id"] == "new-store"
    assert client.knowledge_store_id == "new-store"
    assert {row["asset_id"] for row in client.created_items} == {"asset-a", "asset-b"}
    assert any(update.get("jockey_store_repair_state") == "ready" for update in db.updates)
    assert any(update.get("jockey_store_ready_count") == 2 for update in db.updates)


@pytest.mark.asyncio
async def test_repair_reuses_persisted_ready_store(monkeypatch):
    class ReadyClient(FakeClient):
        async def retrieve_knowledge_store(self):
            return {"id": self.knowledge_store_id, "name": repair.STORE_NAME, "item_count": 2}

    client = ReadyClient()
    db = FakeDB()
    store = await repair.ensure_jockey_store_from_index(
        client,
        db,
        {"jockey_store_id": "persisted-store", "jockey_store_repair_state": "ready"},
    )
    assert store["id"] == "persisted-store"
    assert client.knowledge_store_id == "persisted-store"
