from __future__ import annotations

import hashlib
import json
from pathlib import Path

from fastapi import FastAPI
from fastapi.testclient import TestClient

from backend.knowledge.router import get_store, router


CANONICAL_TEXT = """# D3VONN.IO Master Context

**Context version:** 2026-08-09

Hermes operates the current insurance CRM and deployment knowledge loop.
"""


def make_client() -> TestClient:
    app = FastAPI()
    app.include_router(router)
    return TestClient(app)


def write_canonical(root: Path, content: str = CANONICAL_TEXT) -> Path:
    path = root / "MASTER_CONTEXT.md"
    path.write_text(content, encoding="utf-8")
    return path


def configure_store(monkeypatch, artifact_dir: Path, canonical_path: Path) -> None:
    monkeypatch.setenv("DKOS_ARTIFACT_DIR", str(artifact_dir))
    monkeypatch.setenv("DKOS_CANONICAL_CONTEXT_PATH", str(canonical_path))
    get_store.cache_clear()


def write_artifacts(root: Path) -> None:
    index = {
        "documents": [
            {"id": "MASTER_CONTEXT", "path": "MASTER_CONTEXT.md", "title": "Stale Master Context", "category": "root", "tags": ["bootstrap"], "related": ["AGENT_HERMES"], "summary": "stale indexed context", "content": "old content"},
            {"id": "AGENT_HERMES", "path": "agents/Hermes/README.md", "title": "Hermes", "category": "agent", "tags": ["hermes", "orchestration"], "related": [], "summary": "planner orchestrator workflow"},
            {"id": "SKILL_INSURANCE", "path": "skills/insurance.md", "title": "Insurance", "category": "skills", "tags": ["insurance", "crm"], "related": [], "summary": "lead intake policy follow up"},
        ]
    }
    graph = {"nodes": [{"id": "MASTER_CONTEXT"}], "edges": [], "stats": {"total_nodes": 1}}
    (root / "dkos_index.json").write_text(json.dumps(index), encoding="utf-8")
    (root / "dkos_graph.json").write_text(json.dumps(graph), encoding="utf-8")


def test_knowledge_router_reads_artifacts_and_overlays_canonical(monkeypatch, tmp_path: Path):
    write_artifacts(tmp_path)
    canonical_path = write_canonical(tmp_path)
    configure_store(monkeypatch, tmp_path, canonical_path)
    client = make_client()

    status = client.get("/api/knowledge/status").json()
    assert status["documents"] == 3
    assert status["mode"] == "full_artifacts"
    assert status["canonical_context"]["version"] == "2026-08-09"
    assert status["canonical_context"]["content_sha256"] == hashlib.sha256(CANONICAL_TEXT.encode()).hexdigest()
    assert client.get("/api/knowledge/search", params={"q": "insurance crm"}).json()["results"][0]["id"] == "SKILL_INSURANCE"
    master = client.get("/api/knowledge/entity/MASTER_CONTEXT").json()
    assert master["content"] == CANONICAL_TEXT
    assert master["source"] == "deployed_repository"
    assert any(doc["id"] == "AGENT_HERMES" for doc in client.get("/api/knowledge/related/MASTER_CONTEXT").json()["results"])
    assert client.get("/api/knowledge/graph").json()["nodes"][0]["id"] == "MASTER_CONTEXT"


def test_knowledge_router_uses_canonical_fallback_without_artifacts(monkeypatch, tmp_path: Path):
    canonical_path = write_canonical(tmp_path)
    configure_store(monkeypatch, tmp_path / "missing-artifacts", canonical_path)
    client = make_client()

    status = client.get("/api/knowledge/status")
    assert status.status_code == 200
    assert status.json()["mode"] == "canonical_fallback"
    assert status.json()["artifacts"]["index"] is False

    results = client.get("/api/knowledge/search", params={"q": "insurance CRM"}).json()["results"]
    assert results[0]["id"] == "MASTER_CONTEXT"
    context = client.post(
        "/api/knowledge/context",
        json={"query": "current deployment knowledge", "agent": "Hermes", "limit": 1},
    ).json()
    assert context["documents"][0]["path"] == "MASTER_CONTEXT.md"


def test_knowledge_router_missing_all_sources_returns_503(monkeypatch, tmp_path: Path):
    configure_store(
        monkeypatch,
        tmp_path / "missing-artifacts",
        tmp_path / "missing-context" / "MASTER_CONTEXT.md",
    )
    response = make_client().get("/api/knowledge/status")
    assert response.status_code == 503
    assert response.json()["detail"]["status"] == "not_configured"


def test_context_always_prioritizes_master_context(monkeypatch, tmp_path: Path):
    index = {
        "documents": [
            {"id": "SYSTEM_PROMPT", "path": "SYSTEM_PROMPT.md", "title": "System Prompt", "category": "constitution", "tags": [], "related": [], "summary": "system rules"},
            {"id": "MASTER_CONTEXT", "path": "MASTER_CONTEXT.md", "title": "Stale Master", "category": "root", "tags": ["bootstrap"], "related": [], "summary": "stale canonical context"},
            {"id": "AGENT_HERMES", "path": "agents/Hermes/README.md", "title": "Hermes", "category": "agent", "tags": ["hermes"], "related": [], "summary": "agent context"},
        ]
    }
    (tmp_path / "dkos_index.json").write_text(json.dumps(index), encoding="utf-8")
    canonical_path = write_canonical(tmp_path)
    configure_store(monkeypatch, tmp_path, canonical_path)

    response = make_client().post(
        "/api/knowledge/context",
        json={"query": "system rules", "agent": "Hermes", "limit": 1},
    )

    assert response.status_code == 200
    documents = response.json()["documents"]
    assert len(documents) == 1
    assert documents[0]["path"] == "MASTER_CONTEXT.md"
    assert documents[0]["content"] == CANONICAL_TEXT
