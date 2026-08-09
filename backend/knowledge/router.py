"""DKOS Knowledge API router.

Exposes generated D3VONN Knowledge Operating System artifacts through FastAPI.

Expected artifact directory:
    DKOS_ARTIFACT_DIR=/path/to/dkos/artifacts

Required files:
    dkos_index.json

Optional files:
    dkos_graph.json
    dkos_observability_report.md
    dkos_embedding_manifest.json
"""

from __future__ import annotations

import json
import os
import re
from functools import lru_cache
from pathlib import Path
from typing import Any

from fastapi import APIRouter, HTTPException, Query
from pydantic import BaseModel, Field

router = APIRouter(prefix="/api/knowledge", tags=["knowledge"])


class ContextRequest(BaseModel):
    query: str = Field(..., min_length=1)
    agent: str = "Hermes"
    limit: int = Field(default=10, ge=1, le=50)


class KnowledgeStore:
    def __init__(self, artifact_dir: Path) -> None:
        self.artifact_dir = artifact_dir
        self.index_path = artifact_dir / "dkos_index.json"
        self.graph_path = artifact_dir / "dkos_graph.json"
        self.observability_path = artifact_dir / "dkos_observability_report.md"
        self.embedding_manifest_path = artifact_dir / "dkos_embedding_manifest.json"

        if not self.index_path.exists():
            raise FileNotFoundError(f"Missing required DKOS index artifact: {self.index_path}")

        self.index_payload = self._load_json(self.index_path)
        self.graph_payload = self._load_json(self.graph_path) if self.graph_path.exists() else {"nodes": [], "edges": [], "stats": {}}
        self.documents: list[dict[str, Any]] = self.index_payload.get("documents", [])
        self.by_id = {doc.get("id"): doc for doc in self.documents if doc.get("id")}
        self.by_path = {doc.get("path"): doc for doc in self.documents if doc.get("path")}

    @staticmethod
    def _load_json(path: Path) -> dict[str, Any]:
        return json.loads(path.read_text(encoding="utf-8"))

    @staticmethod
    def _tokens(text: str) -> set[str]:
        return {token.lower() for token in re.findall(r"[a-zA-Z0-9_]+", text)}

    def status(self) -> dict[str, Any]:
        return {
            "status": "ready",
            "artifact_dir": str(self.artifact_dir),
            "documents": len(self.documents),
            "graph_nodes": len(self.graph_payload.get("nodes", [])),
            "graph_edges": len(self.graph_payload.get("edges", [])),
            "artifacts": {
                "index": self.index_path.exists(),
                "graph": self.graph_path.exists(),
                "observability_report": self.observability_path.exists(),
                "embedding_manifest": self.embedding_manifest_path.exists(),
            },
        }

    def search(self, query: str, limit: int = 10) -> list[dict[str, Any]]:
        query_terms = self._tokens(query)
        results: list[dict[str, Any]] = []

        for doc in self.documents:
            searchable = " ".join(
                str(part or "")
                for part in [
                    doc.get("id"),
                    doc.get("path"),
                    doc.get("title"),
                    doc.get("category"),
                    " ".join(doc.get("tags") or []),
                    " ".join(doc.get("related") or []),
                    doc.get("summary"),
                ]
            )
            overlap = query_terms & self._tokens(searchable)
            if overlap:
                results.append(
                    {
                        "id": doc.get("id"),
                        "path": doc.get("path"),
                        "title": doc.get("title"),
                        "category": doc.get("category"),
                        "tags": doc.get("tags", []),
                        "score": len(overlap),
                        "matches": sorted(overlap),
                    }
                )

        results.sort(key=lambda item: item["score"], reverse=True)
        return results[:limit]

    def entity(self, identifier: str) -> dict[str, Any] | None:
        return self.by_id.get(identifier) or self.by_path.get(identifier)

    def related(self, identifier: str, limit: int = 20) -> list[dict[str, Any]]:
        doc = self.entity(identifier)
        if not doc:
            return []

        related_docs: list[dict[str, Any]] = []
        seen: set[str] = set()

        for rel in doc.get("related", []):
            target = self.entity(rel)
            if target and target.get("id") not in seen:
                related_docs.append(target)
                seen.add(str(target.get("id")))

        category = doc.get("category")
        tags = set(doc.get("tags", []))
        for candidate in self.documents:
            candidate_id = str(candidate.get("id"))
            if candidate_id in seen or candidate is doc:
                continue
            if candidate.get("category") == category or tags.intersection(set(candidate.get("tags", []))):
                related_docs.append(candidate)
                seen.add(candidate_id)
            if len(related_docs) >= limit:
                break

        return related_docs[:limit]

    def context(self, query: str, agent: str, limit: int) -> dict[str, Any]:
        ranked = self.search(f"{query} {agent}", limit=limit)
        master_context = [
            doc for doc in self.documents
            if doc.get("path") == "MASTER_CONTEXT.md"
        ]
        required = [
            doc for doc in self.documents
            if doc.get("path") == "SYSTEM_PROMPT.md"
            or doc.get("category") == "constitution"
            or agent.lower() in str(doc.get("path", "")).lower()
            or agent.lower() in str(doc.get("id", "")).lower()
        ]

        selected: list[dict[str, Any]] = []
        seen: set[str] = set()
        for doc in master_context + required + ranked:
            doc_id = str(doc.get("id") or doc.get("path"))
            if doc_id not in seen:
                selected.append(doc)
                seen.add(doc_id)
            if len(selected) >= limit:
                break

        return {
            "request_id": "dkos_runtime_context",
            "query": query,
            "agent": agent,
            "documents": selected,
        }


@lru_cache(maxsize=1)
def get_store() -> KnowledgeStore:
    artifact_dir = Path(os.getenv("DKOS_ARTIFACT_DIR", ".dkos/artifacts")).resolve()
    return KnowledgeStore(artifact_dir)


def store_or_503() -> KnowledgeStore:
    try:
        return get_store()
    except FileNotFoundError as exc:
        raise HTTPException(
            status_code=503,
            detail={
                "status": "not_configured",
                "message": str(exc),
                "hint": "Generate DKOS artifacts and set DKOS_ARTIFACT_DIR to their directory.",
            },
        ) from exc


@router.get("/status")
async def knowledge_status() -> dict[str, Any]:
    return store_or_503().status()


@router.get("/search")
async def knowledge_search(q: str = Query(..., min_length=1), limit: int = Query(10, ge=1, le=50)) -> dict[str, Any]:
    return {"query": q, "results": store_or_503().search(q, limit=limit)}


@router.get("/entity/{identifier:path}")
async def knowledge_entity(identifier: str) -> dict[str, Any]:
    entity = store_or_503().entity(identifier)
    if not entity:
        raise HTTPException(status_code=404, detail="Knowledge entity not found")
    return entity


@router.get("/related/{identifier:path}")
async def knowledge_related(identifier: str, limit: int = Query(20, ge=1, le=100)) -> dict[str, Any]:
    return {"identifier": identifier, "results": store_or_503().related(identifier, limit=limit)}


@router.get("/graph")
async def knowledge_graph() -> dict[str, Any]:
    return store_or_503().graph_payload


@router.post("/context")
async def knowledge_context(request: ContextRequest) -> dict[str, Any]:
    return store_or_503().context(request.query, request.agent, request.limit)
