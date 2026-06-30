"""
backend/rag/pinecone_client.py — Pinecone vector storage adapter for D3VONN RAG.

This module is intentionally lightweight and dependency-tolerant:
- It uses the official Pinecone SDK when installed.
- It fails closed with clear runtime errors when env vars/dependency are missing.
- It keeps all API keys server-side.
"""
from __future__ import annotations

import os
from dataclasses import dataclass
from typing import Any, Iterable


class PineconeConfigurationError(RuntimeError):
    """Raised when Pinecone is not configured for runtime use."""


@dataclass(frozen=True)
class VectorRecord:
    """Single vector payload prepared for Pinecone upsert."""

    id: str
    values: list[float]
    metadata: dict[str, Any]


class DevonnPineconeClient:
    """Small adapter around Pinecone index operations."""

    def __init__(self, api_key: str | None = None, index_name: str | None = None):
        self.api_key = api_key or os.getenv("PINECONE_API_KEY", "")
        self.index_name = index_name or os.getenv("PINECONE_INDEX", "")
        self._index: Any | None = None

    @property
    def configured(self) -> bool:
        return bool(self.api_key and self.index_name)

    def _require_index(self) -> Any:
        if self._index is not None:
            return self._index

        if not self.configured:
            raise PineconeConfigurationError(
                "PINECONE_API_KEY and PINECONE_INDEX must be configured."
            )

        try:
            from pinecone import Pinecone  # type: ignore
        except Exception as exc:  # pragma: no cover - depends on deployment env
            raise PineconeConfigurationError(
                "The pinecone package is not installed. Add pinecone-client/pinecone to backend dependencies."
            ) from exc

        pc = Pinecone(api_key=self.api_key)
        self._index = pc.Index(self.index_name)
        return self._index

    async def upsert_vectors(
        self,
        vectors: Iterable[VectorRecord],
        *,
        namespace: str = "default",
    ) -> dict[str, Any]:
        """Upsert vectors into Pinecone with namespace isolation."""
        index = self._require_index()
        payload = [
            {"id": item.id, "values": item.values, "metadata": item.metadata}
            for item in vectors
        ]
        if not payload:
            return {"upserted_count": 0}
        result = index.upsert(vectors=payload, namespace=namespace)
        return result if isinstance(result, dict) else {"result": str(result), "upserted_count": len(payload)}

    async def query_vectors(
        self,
        embedding: list[float],
        *,
        namespace: str = "default",
        top_k: int = 5,
        filter: dict[str, Any] | None = None,
        include_metadata: bool = True,
    ) -> dict[str, Any]:
        """Query Pinecone for the closest matching chunks."""
        index = self._require_index()
        result = index.query(
            vector=embedding,
            namespace=namespace,
            top_k=top_k,
            filter=filter,
            include_metadata=include_metadata,
        )
        if hasattr(result, "to_dict"):
            return result.to_dict()
        return result if isinstance(result, dict) else {"matches": []}

    async def delete_document_vectors(
        self,
        document_id: str,
        *,
        namespace: str = "default",
    ) -> dict[str, Any]:
        """Delete all vectors for a document_id inside a namespace."""
        index = self._require_index()
        result = index.delete(filter={"document_id": {"$eq": document_id}}, namespace=namespace)
        return result if isinstance(result, dict) else {"result": str(result)}

    async def health_check_pinecone(self) -> dict[str, Any]:
        """Return a lightweight readiness status for Pinecone."""
        if not self.configured:
            return {"status": "not_configured", "index": self.index_name or None}
        try:
            self._require_index()
            return {"status": "configured", "index": self.index_name}
        except Exception as exc:
            return {"status": "error", "index": self.index_name, "error": str(exc)}


def namespace_for_user(user_id: str | None, tenant_id: str | None = None) -> str:
    """Build a stable namespace for user/tenant isolation."""
    if tenant_id:
        return f"tenant:{tenant_id}"
    if user_id:
        return f"user:{user_id}"
    return "default"
