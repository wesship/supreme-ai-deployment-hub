from __future__ import annotations

import json
from pathlib import Path

from fastapi import FastAPI
from fastapi.testclient import TestClient

from backend.knowledge.router import get_store, router


def make_client() -> TestClient:
    app = FastAPI()
    app.include_router(router)
    return TestClient(app)


def write_artifacts(root: Path) -> None:
    index = {
        "documents": [
            {"id": "MASTER_CONTEXT", "path": "MASTER_CONTEXT.md", "title": "Master Context", "category": "root", "tags": ["bootstrap"], "related": ["AGENT_HERMES"], "summary": "bootstrap context"},
            {"id": "AGENT_HERMES", "path": "agents/Hermes/README.md", "title": "Hermes", "category": "agent", "tags": ["hermes", "orchestration"], "related": [], "summary": "planner orchestrator workflow"},
            {"id": "SKILL_INSURANCE", "path": "skills/insurance.md", "title": "Insurance", "category": "skills", "tags": ["insurance", "crm"], "related": [], "summary": "lead intake policy follow up"},
        ]
    }
    graph = {"nodes": [{"id": "MASTER_CONTEXT"}], "edges": [], "stats": {"total_nodes": 1}}
    (root / "dkos_index.json").write_text(json.dumps(index), encoding="utf-8")
    (root / "dkos_graph.json").write_text(json.dumps(graph), encoding="utf-8")


def test_knowledge_router_reads_artifacts(monkeypatch, tmp_path: Path):
    write_artifacts(tmp_path)
    monkeypatch.setenv("DKOS_ARTIFACT_DIR", str(tmp_path))
    get_store.cache_clear()
    client = make_client()

    assert client.get("/api/knowledge/status").json()["documents"] == 3
    assert client.get("/api/knowledge/search", params={"q": "insurance crm"}).json()["results"][0]["id"] == "SKILL_INSURANCE"
    assert client.get("/api/knowledge/entity/MASTER_CONTEXT").json()["path"] == "MASTER_CONTEXT.md"
    assert any(doc["id"] == "AGENT_HERMES" for doc in client.get("/api/knowledge/related/MASTER_CONTEXT").json()["results"])
    assert client.get("/api/knowledge/graph").json()["nodes"][0]["id"] == "MASTER_CONTEXT"
    assert client.post("/api/knowledge/context", json={"query": "Build insurance workflow", "agent": "Hermes", "limit": 5}).json()["documents"]


def test_knowledge_router_missing_artifacts_returns_503(monkeypatch, tmp_path: Path):
    monkeypatch.setenv("DKOS_ARTIFACT_DIR", str(tmp_path / "missing"))
    get_store.cache_clear()
    response = make_client().get("/api/knowledge/status")
    assert response.status_code == 503
    assert response.json()["detail"]["status"] == "not_configured"

def test_context_always_prioritizes_master_context(monkeypatch, tmp_path: Path):
    index = {
        "documents": [
            {"id": "SYSTEM_PROMPT", "path": "SYSTEM_PROMPT.md", "title": "System Prompt", "category": "constitution", "tags": [], "related": [], "summary": "system rules"},
            {"id": "MASTER_CONTEXT", "path": "MASTER_CONTEXT.md", "title": "Master Context", "category": "root", "tags": ["bootstrap"], "related": [], "summary": "canonical context"},
            {"id": "AGENT_HERMES", "path": "agents/Hermes/README.md", "title": "Hermes", "category": "agent", "tags": ["hermes"], "related": [], "summary": "agent context"},
        ]
    }
    (tmp_path / "dkos_index.json").write_text(json.dumps(index), encoding="utf-8")
    monkeypatch.setenv("DKOS_ARTIFACT_DIR", str(tmp_path))
    get_store.cache_clear()

    response = make_client().post(
        "/api/knowledge/context",
        json={"query": "system rules", "agent": "Hermes", "limit": 1},
    )

    assert response.status_code == 200
    documents = response.json()["documents"]
    assert len(documents) == 1
    assert documents[0]["path"] == "MASTER_CONTEXT.md"

