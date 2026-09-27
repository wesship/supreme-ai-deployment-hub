from __future__ import annotations

from fastapi import FastAPI
from fastapi.testclient import TestClient

from backend.app.routers.runtime_identity import router


def make_client() -> TestClient:
    app = FastAPI()
    app.include_router(router, prefix="/api")
    return TestClient(app)


def test_runtime_identity_matches_canonical_repository(monkeypatch):
    monkeypatch.setenv("RAILWAY_GIT_COMMIT_SHA", "abc123")
    response = make_client().get("/api/runtime/identity")

    assert response.status_code == 200
    body = response.json()
    assert body["service"] == "d3vonn-api"
    assert body["repository"] == "wesship/supreme-ai-deployment-hub"
    assert body["ui_authority"] == "repository"
    assert body["contract_version"] == "1.0"
    assert body["commit_sha"] == "abc123"


def test_runtime_identity_is_non_sensitive_when_commit_unavailable(monkeypatch):
    for name in (
        "RAILWAY_GIT_COMMIT_SHA",
        "VERCEL_GIT_COMMIT_SHA",
        "GIT_COMMIT_SHA",
        "COMMIT_SHA",
    ):
        monkeypatch.delenv(name, raising=False)

    response = make_client().get("/api/runtime/identity")

    assert response.status_code == 200
    body = response.json()
    assert body["commit_sha"] is None
    assert set(body) == {
        "service",
        "repository",
        "contract_version",
        "commit_sha",
        "ui_authority",
    }
