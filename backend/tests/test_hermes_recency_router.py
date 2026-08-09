from __future__ import annotations

from fastapi import FastAPI
from fastapi.testclient import TestClient

import backend.hermes.recency_router as recency


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
