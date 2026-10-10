from __future__ import annotations

import pytest

from backend.ai_films import generated_shot_qa_worker as worker
from backend.ai_films.twelvelabs import TwelveLabsError

PROJECT_ID = "proj-1"
SHOT_ID = "shot-1"
ASSET_ID = "asset-1"


class FakeDB:
    def __init__(self, asset_meta=None):
        self.asset_meta = dict(asset_meta or {})
        self.job_updates = []

    async def _request(self, method, table, *, params=None, payload=None, representation=False):
        if method == "GET" and table == "ai_film_production_bibles":
            return [{"bible": {"version": 1}}]
        if method == "GET" and table == "ai_film_shot_manifests":
            return [{"id": "m1", "manifest": {"shots": [{"shot_id": SHOT_ID}]}}]
        if method == "GET" and table == "ai_film_projects":
            return [{"metadata": {"jockey_store_id": "ks-1"}}]
        if method == "GET" and table == "ai_film_assets":
            return [{"metadata": dict(self.asset_meta)}]
        return []

    async def update_job(self, job_id, values):
        self.job_updates.append(values)


class FakeClient:
    existing_items: dict = {}

    def __init__(self):
        self.knowledge_store_id = "ks-1"

    async def _request(self, method, path, *, payload=None, params=None):
        item_id = path.rsplit("/", 1)[-1]
        if item_id in self.existing_items:
            return self.existing_items[item_id]
        raise TwelveLabsError("TwelveLabs request failed with HTTP 404")

    async def reason(self, prompt, instructions=None):
        return {"id": "resp-1", "text": '{"decision":"pass","reasons":["ok"]}'}


class FakeRunner:
    existing_assets: dict = {}
    created_assets: list = []
    created_items: list = []

    def __init__(self, client):
        self.client = client

    async def _retrieve_asset(self, asset_id):
        if asset_id in self.existing_assets:
            return self.existing_assets[asset_id]
        raise TwelveLabsError(f"TwelveLabs asset {asset_id} is not retrievable")

    async def _create_asset(self, **kwargs):
        self.created_assets.append(kwargs)
        return {"_id": f"tl-new-{len(self.created_assets)}"}

    async def _wait_for_asset(self, asset_id, **kwargs):
        return {"status": "ready"}

    async def _create_item(self, asset_id, **kwargs):
        self.created_items.append(asset_id)
        return {"_id": f"ksi-new-{len(self.created_items)}"}

    async def _wait_for_item(self, item_id, **kwargs):
        return {"status": "ready"}


class FakeAnalyze:
    async def analyze_asset(self, *args, **kwargs):
        return {"data": "looks fine"}


@pytest.fixture(autouse=True)
def _patch(monkeypatch):
    FakeRunner.existing_assets = {}
    FakeRunner.created_assets = []
    FakeRunner.created_items = []
    FakeClient.existing_items = {}

    async def fake_sign(db, path):
        return "https://signed.example/shot.mp4"

    monkeypatch.setattr(worker, "_sign_master", fake_sign)
    monkeypatch.setattr(worker, "TwelveLabsClient", FakeClient)
    monkeypatch.setattr(worker, "TwelveLabsIngestionRunner", FakeRunner)
    monkeypatch.setattr(worker, "TwelveLabsAnalyzeClient", FakeAnalyze)
    monkeypatch.setattr(worker, "_response_text", lambda r: str(r.get("text") or r.get("data") or ""))


def _job(qa=None):
    return {
        "id": "job-1",
        "project_id": PROJECT_ID,
        "input": {"shot_id": SHOT_ID},
        "output": {"shot_id": SHOT_ID, "generated_asset_id": ASSET_ID, "object_path": "films/shot.mp4", "qa": dict(qa or {})},
    }


@pytest.mark.asyncio
async def test_first_run_creates_asset_and_item():
    qa = await worker.qa_generated_shot(_job(), FakeDB())
    assert len(FakeRunner.created_assets) == 1
    assert FakeRunner.created_items == ["tl-new-1"]
    assert qa["twelvelabs_item_id"] == "ksi-new-1"


@pytest.mark.asyncio
async def test_recovered_run_reuses_asset_and_item_from_job_output():
    FakeRunner.existing_assets = {"tl-old": {"status": "ready"}}
    FakeClient.existing_items = {"ksi-old": {"status": "ready", "asset_id": "tl-old"}}
    job = _job({"state": "in_progress", "twelvelabs_asset_id": "tl-old", "twelvelabs_item_id": "ksi-old"})

    qa = await worker.qa_generated_shot(job, FakeDB())

    assert FakeRunner.created_assets == []
    assert FakeRunner.created_items == []
    assert (qa["twelvelabs_asset_id"], qa["twelvelabs_item_id"]) == ("tl-old", "ksi-old")


@pytest.mark.asyncio
async def test_requeued_job_reuses_ids_recorded_on_film_asset():
    FakeRunner.existing_assets = {"tl-old": {"status": "ready"}}
    FakeClient.existing_items = {"ksi-old": {"status": "ready", "asset_id": "tl-old"}}
    db = FakeDB({"twelvelabs_asset_id": "tl-old", "twelvelabs_item_id": "ksi-old"})

    await worker.qa_generated_shot(_job({"state": "pending_generated_qa"}), db)

    assert FakeRunner.created_assets == []
    assert FakeRunner.created_items == []


@pytest.mark.asyncio
async def test_reused_asset_with_missing_item_creates_only_the_item():
    FakeRunner.existing_assets = {"tl-old": {"status": "ready"}}
    job = _job({"twelvelabs_asset_id": "tl-old", "twelvelabs_item_id": "ksi-deleted"})

    await worker.qa_generated_shot(job, FakeDB())

    assert FakeRunner.created_assets == []
    assert FakeRunner.created_items == ["tl-old"]


@pytest.mark.asyncio
async def test_missing_asset_forces_fresh_asset_and_item():
    FakeClient.existing_items = {"ksi-old": {"status": "ready", "asset_id": "tl-gone"}}
    job = _job({"twelvelabs_asset_id": "tl-gone", "twelvelabs_item_id": "ksi-old"})

    await worker.qa_generated_shot(job, FakeDB())

    assert len(FakeRunner.created_assets) == 1
    assert FakeRunner.created_items == ["tl-new-1"]
