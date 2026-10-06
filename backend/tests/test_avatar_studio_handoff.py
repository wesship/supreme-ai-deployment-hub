"""Mocked HTTP boundary tests. No live account, DB writes or provider calls."""
import json
from copy import deepcopy
from uuid import UUID

import httpx
import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient

from backend.ai_films import avatar_studio_router as studio

ACTOR = "11111111-1111-4111-8111-111111111111"
PROJECT = "22222222-2222-4222-8222-222222222222"
OTHER = "33333333-3333-4333-8333-333333333333"
JOB = "44444444-4444-4444-8444-444444444444"
ASSET = "55555555-5555-4555-8555-555555555555"
HEADERS = {"Authorization": "Bearer caller-token"}
PATH = f"/api/ai-films/avatar-studio/projects/{PROJECT}"


def payload():
    return {"request_id": "66666666-6666-4666-8666-666666666666", "title": "Reviewed bulletin", "template": "news_anchor",
            "stage_claims": [{"stage": s, "status": "render_completed"} for s in ("authoring", "review", "render", "export")]}


@pytest.fixture
def gateway(monkeypatch):
    monkeypatch.setenv("SUPABASE_URL", "https://store.example")
    monkeypatch.setenv("SUPABASE_ANON_KEY", "publishable-test-key")
    monkeypatch.setenv("AI_FILMS_AVATAR_HANDOFF_ENABLED", "true")
    state = {"calls": [], "scenes": {}, "actor": ACTOR, "owner": ACTOR, "job_status": "completed", "asset_id": ASSET,
             "bucket": "ai-film-renders", "path": f"{PROJECT}/generated/{JOB}/clip.mp4", "provenance": JOB,
             "signed": None, "anonymous": False, "auth_status": 200, "db_status": 200, "race": False}

    def handler(req):
        state["calls"].append(req)
        assert req.headers["authorization"] == "Bearer caller-token"
        assert req.headers["apikey"] == "publishable-test-key"
        if req.url.path == "/auth/v1/user":
            return httpx.Response(state["auth_status"], json={"id": state["actor"], "is_anonymous": state["anonymous"]})
        if state["db_status"] != 200:
            return httpx.Response(state["db_status"], text="secret provider diagnostic")
        if req.url.path.endswith("ai_film_projects"):
            if req.url.params.get("owner_id") != f"eq.{state['owner']}":
                return httpx.Response(200, json=[])
            return httpx.Response(200, json=[{"id": PROJECT, "owner_id": state["owner"], "title": "My film"}])
        if req.url.path.endswith("ai_film_scenes"):
            if req.method == "POST":
                row = json.loads(req.content)
                state["scenes"][row["id"]] = row
                if state["race"]:
                    return httpx.Response(409, json={})
                return httpx.Response(201, json=[row])
            row = state["scenes"].get(req.url.params["id"].removeprefix("eq."))
            return httpx.Response(200, json=[row] if row else [])
        if req.url.path.endswith("ai_film_render_jobs"):
            return httpx.Response(200, json=[{"status": state["job_status"], "output": {"generated_asset_id": state["asset_id"]}}])
        if req.url.path.endswith("ai_film_assets"):
            return httpx.Response(200, json=[{"id": ASSET, "storage_path": state["path"], "status": "selected",
                "metadata": {"storage_bucket": state["bucket"], "render_job_id": state["provenance"]}}])
        if "/storage/v1/object/sign/" in req.url.path:
            assert json.loads(req.content) == {"expiresIn": 60}
            signed = state["signed"] or req.url.path.removeprefix("/storage/v1") + "?token=short-lived"
            return httpx.Response(200, json={"signedURL": signed})
        raise AssertionError(f"Unexpected request {req.method} {req.url}")

    original = studio.CallerStore
    monkeypatch.setattr(studio, "CallerStore", lambda token: original(token, transport=httpx.MockTransport(handler)))
    app = FastAPI()
    app.include_router(studio.router, prefix="/api")
    with TestClient(app) as client:
        yield client, state


def test_missing_auth_never_calls_store(gateway):
    client, state = gateway
    assert client.get("/api/ai-films/avatar-studio/status").status_code == 401
    assert not state["calls"]


@pytest.mark.parametrize("auth_status", [401, 403])
def test_auth_rejection(gateway, auth_status):
    client, state = gateway
    state["auth_status"] = auth_status
    assert client.get("/api/ai-films/avatar-studio/status", headers=HEADERS).status_code == auth_status
    assert len(state["calls"]) == 1


def test_anonymous_user_refused(gateway):
    client, state = gateway
    state["anonymous"] = True
    assert client.post(PATH + "/handoffs", headers=HEADERS, json=payload()).status_code == 403
    assert len(state["calls"]) == 1


def test_status_cannot_enable_execution(gateway):
    client, _ = gateway
    result = client.get("/api/ai-films/avatar-studio/status", headers=HEADERS)
    assert result.headers["cache-control"] == "no-store"
    assert result.json()["render_enabled"] is False
    assert result.json()["consent_verified"] is False


def test_disabled_handoff_has_no_db_writes(gateway, monkeypatch):
    client, state = gateway
    monkeypatch.delenv("AI_FILMS_AVATAR_HANDOFF_ENABLED")
    assert client.post(PATH + "/handoffs", headers=HEADERS, json=payload()).status_code == 404
    assert len(state["calls"]) == 1


def test_owned_project_list_uses_caller(gateway):
    client, state = gateway
    result = client.get("/api/ai-films/avatar-studio/projects", headers=HEADERS)
    assert result.json()["items"][0]["id"] == PROJECT
    assert state["calls"][-1].url.params["owner_id"] == f"eq.{ACTOR}"


def test_other_owner_refused_before_write(gateway):
    client, state = gateway
    state["owner"] = OTHER
    assert client.post(PATH + "/handoffs", headers=HEADERS, json=payload()).status_code == 404
    assert not any(r.method == "POST" for r in state["calls"])


def test_imported_completion_is_always_saved_as_draft(gateway):
    client, state = gateway
    result = client.post(PATH + "/handoffs", headers=HEADERS, json=payload())
    assert result.status_code == 200
    assert result.json()["execution"] == "blocked"
    assert result.json()["status"] == "draft"
    row = next(iter(state["scenes"].values()))
    assert row["status"] == "draft"
    assert "screenplay" not in row
    assert row["production_package"]["claims_verified"] is False
    assert not any("render_jobs" in str(r.url) for r in state["calls"])


def test_identical_retries_do_not_duplicate_and_changes_conflict(gateway):
    client, state = gateway
    first = client.post(PATH + "/handoffs", headers=HEADERS, json=payload())
    second = client.post(PATH + "/handoffs", headers=HEADERS, json=payload())
    assert first.json() == second.json()
    assert len(state["scenes"]) == 1
    changed = payload(); changed["title"] = "Changed bulletin"
    assert client.post(PATH + "/handoffs", headers=HEADERS, json=changed).status_code == 409


def test_simultaneous_duplicate_recovers_matching_record(gateway):
    client, state = gateway
    state["race"] = True
    assert client.post(PATH + "/handoffs", headers=HEADERS, json=payload()).status_code == 200
    assert len(state["scenes"]) == 1


@pytest.mark.parametrize("extra", [{"content": "private script"}, {"consent": True}, {"owner_id": OTHER}, {"render_job_id": JOB}])
def test_private_or_authoritative_fields_rejected(gateway, extra):
    client, state = gateway
    assert client.post(PATH + "/handoffs", headers=HEADERS, json={**payload(), **extra}).status_code == 422
    assert not state["calls"]


def test_duplicate_stages_rejected(gateway):
    client, _ = gateway
    body = payload(); body["stage_claims"][0] = deepcopy(body["stage_claims"][1])
    assert client.post(PATH + "/handoffs", headers=HEADERS, json=body).status_code == 422


def test_render_never_queues(gateway):
    client, state = gateway
    assert client.post(PATH + "/render", headers=HEADERS).status_code == 503
    assert all(r.method == "GET" for r in state["calls"])


def test_store_failure_does_not_leak_details(gateway):
    client, state = gateway
    state["db_status"] = 500
    result = client.get("/api/ai-films/avatar-studio/projects", headers=HEADERS)
    assert result.status_code == 503
    assert "secret" not in result.text


def test_registered_output_signed_by_caller_without_publication(gateway):
    client, state = gateway
    result = client.get(PATH + f"/jobs/{JOB}/artifact", headers=HEADERS)
    assert result.status_code == 200
    assert result.headers["cache-control"] == "no-store"
    assert result.json()["expires_in"] == 60
    assert result.json()["publication_approved"] is False
    assert state["calls"][-1].headers["authorization"] == HEADERS["Authorization"]


@pytest.mark.parametrize("field,value,code", [("job_status", "running", 404), ("asset_id", "bad", 409),
    ("provenance", OTHER, 409), ("path", "../other/file.mp4", 409), ("path", f"{OTHER}/file.mp4", 409),
    ("path", f"{PROJECT}/../file.mp4", 409), ("bucket", "public", 409), ("signed", "https://evil.example/file.mp4?token=secret", 503)])
def test_invalid_artifact_never_yields_link(gateway, field, value, code):
    client, state = gateway
    state[field] = value
    result = client.get(PATH + f"/jobs/{JOB}/artifact", headers=HEADERS)
    assert result.status_code == code
    assert "url" not in result.json()


def test_other_owner_artifact_is_not_signed(gateway):
    client, state = gateway
    state["owner"] = OTHER
    assert client.get(PATH + f"/jobs/{JOB}/artifact", headers=HEADERS).status_code == 404
    assert not any("/storage/" in str(r.url) for r in state["calls"])
