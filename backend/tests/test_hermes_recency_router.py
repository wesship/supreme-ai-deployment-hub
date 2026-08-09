from __future__ import annotations

from fastapi import FastAPI
from fastapi.testclient import TestClient

import backend.hermes.recency_router as recency
from backend.auth.supabase_jwt import require_occ_access


def make_client(monkeypatch, token: str = "test-recency-token") -> TestClient:
    monkeypatch.setenv("HERMES_RECENCY_WRITE_TOKEN", token)
    app = FastAPI()
    app.include_router(recency.router)
    return TestClient(app)


def payload(status: str = "VERIFIED") -> dict:
    return {
        "commit_sha": "e60afd0c0b5b54c928b53fce540cb386fe149edb",
        "canonical_context_version": "2026-08-09",
        "canonical_context_sha256": "a" * 64,
        "verification_status": status,
        "source": "github_actions",
        "verification_report": {"verified": status == "VERIFIED"},
    }


def test_acknowledgement_requires_machine_token(monkeypatch):
    client = make_client(monkeypatch)
    response = client.post("/api/hermes/recency/acknowledge", json=payload())
    assert response.status_code == 401


def test_acknowledgement_is_unavailable_without_server_secret(monkeypatch):
    monkeypatch.delenv("HERMES_RECENCY_WRITE_TOKEN", raising=False)
    app = FastAPI()
    app.include_router(recency.router)
    response = TestClient(app).post(
        "/api/hermes/recency/acknowledge",
        headers={"X-Hermes-Recency-Token": "anything"},
        json=payload(),
    )
    assert response.status_code == 503


def test_verified_acknowledgement_creates_and_completes_task(monkeypatch):
    transitions: list[str] = []
    task = {"id": "task-1", "status": "PENDING"}

    async def fake_lookup(_: str):
        return None

    async def fake_create(**kwargs):
        assert kwargs["task_type"] == "repo_recency"
        assert kwargs["correlation_id"].startswith("repo-recency:e60afd0")
        return task.copy()

    async def fake_transition(task_id, new_status, **kwargs):
        assert task_id == "task-1"
        value = new_status.value if hasattr(new_status, "value") else new_status
        transitions.append(value)
        return {"id": task_id, "status": value, "output_data": kwargs.get("output_data")}

    monkeypatch.setattr(recency, "get_task_by_correlation_id", fake_lookup)
    monkeypatch.setattr(recency, "create_task", fake_create)
    monkeypatch.setattr(recency, "transition_task", fake_transition)

    response = make_client(monkeypatch).post(
        "/api/hermes/recency/acknowledge",
        headers={"X-Hermes-Recency-Token": "test-recency-token"},
        json=payload(),
    )

    assert response.status_code == 200
    assert response.json()["created"] is True
    assert transitions == ["LOCKED", "RUNNING", "COMPLETED"]


def test_mismatch_moves_task_to_manual_review(monkeypatch):
    transitions: list[str] = []

    async def fake_lookup(_: str):
        return {"id": "task-2", "status": "RUNNING"}

    async def fake_transition(task_id, new_status, **kwargs):
        value = new_status.value if hasattr(new_status, "value") else new_status
        transitions.append(value)
        return {"id": task_id, "status": value}

    monkeypatch.setattr(recency, "get_task_by_correlation_id", fake_lookup)
    monkeypatch.setattr(recency, "transition_task", fake_transition)

    response = make_client(monkeypatch).post(
        "/api/hermes/recency/acknowledge",
        headers={"X-Hermes-Recency-Token": "test-recency-token"},
        json=payload("MISMATCH"),
    )

    assert response.status_code == 200
    assert transitions == ["MANUAL_REVIEW"]


def test_repeated_acknowledgement_is_idempotent(monkeypatch):
    async def fake_lookup(_: str):
        return {"id": "task-3", "status": "COMPLETED"}

    async def unexpected_transition(*args, **kwargs):
        raise AssertionError("terminal acknowledgement must not transition again")

    monkeypatch.setattr(recency, "get_task_by_correlation_id", fake_lookup)
    monkeypatch.setattr(recency, "transition_task", unexpected_transition)

    response = make_client(monkeypatch).post(
        "/api/hermes/recency/acknowledge",
        headers={"X-Hermes-Recency-Token": "test-recency-token"},
        json=payload(),
    )

    assert response.status_code == 200
    assert response.json()["idempotent"] is True
    assert response.json()["task"]["status"] == "COMPLETED"


def test_recency_status_reconciles_runtime_and_persisted_task(monkeypatch):
    context_hash = "b" * 64
    completed = {
        "id": "task-status-1",
        "status": "COMPLETED",
        "input_data": {"commit_sha": "5cfea216b26ac39783ce73266b8627dafc087e52"},
        "output_data": {
            "verification_status": "VERIFIED",
            "canonical_context_version": "2026-08-09",
            "canonical_context_sha256": context_hash,
        },
        "created_at": "2026-08-09T04:50:44+00:00",
        "completed_at": "2026-08-09T04:50:45+00:00",
        "correlation_id": "repo-recency:test",
    }

    async def fake_list(_: str, limit: int = 25):
        assert limit == 25
        return [completed]

    class FakeStore:
        def status(self):
            return {
                "mode": "canonical_fallback",
                "deployed_commit_sha": "5cfea216b26ac39783ce73266b8627dafc087e52",
                "canonical_context": {
                    "present": True,
                    "version": "2026-08-09",
                    "content_sha256": context_hash,
                    "source": "deployed_repository",
                },
            }

    monkeypatch.setattr(recency, "list_tasks_by_type", fake_list)
    monkeypatch.setattr(recency, "get_store", lambda: FakeStore())

    app = FastAPI()
    app.include_router(recency.router)
    app.dependency_overrides[require_occ_access] = lambda: object()
    response = TestClient(app).get("/api/hermes/recency/status")

    assert response.status_code == 200
    body = response.json()
    assert body["status"] == "synchronized"
    assert body["synchronized"] is True
    assert body["last_verified"]["commit_sha"].startswith("5cfea216")
    assert body["runtime"]["canonical_context"]["content_sha256"] == context_hash


def test_recency_status_flags_manual_review(monkeypatch):
    async def fake_list(_: str, limit: int = 25):
        return [
            {
                "id": "task-review",
                "status": "MANUAL_REVIEW",
                "input_data": {},
                "output_data": {"verification_status": "MISMATCH"},
            }
        ]

    class FakeStore:
        def status(self):
            return {"mode": "canonical_fallback", "canonical_context": {}}

    monkeypatch.setattr(recency, "list_tasks_by_type", fake_list)
    monkeypatch.setattr(recency, "get_store", lambda: FakeStore())

    app = FastAPI()
    app.include_router(recency.router)
    app.dependency_overrides[require_occ_access] = lambda: object()
    body = TestClient(app).get("/api/hermes/recency/status").json()

    assert body["status"] == "attention_required"
    assert body["pending_manual_review"] == 1
