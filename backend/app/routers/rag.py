"""
Devonn.ai Backend Proxy — /api/rag
RAG pipeline: document ingestion, context retrieval, and deletion.
Uses OpenAI for embeddings and Pinecone for vector storage.
All API keys are server-side only.
"""
import asyncio
import logging
from functools import lru_cache
from typing import Any

import httpx
from fastapi import APIRouter, Depends, HTTPException, status

from backend.app.config import get_settings
from backend.app.middleware.auth import get_current_user_id
from backend.app.middleware.rate_limit import rate_limit
from backend.app.models.proxy import (
    RAGDeleteRequest,
    RAGIngestRequest,
    RAGIngestResponse,
    RAGRetrieveRequest,
    RAGRetrieveResponse,
    RetrievedContext,
)

logger = logging.getLogger(__name__)
router = APIRouter()

OPENAI_EMBED_URL = "https://api.openai.com/v1/embeddings"


# ─── Helpers ──────────────────────────────────────────────────────────────────

async def _embed_texts(texts: list[str], api_key: str, model: str, dimensions: int) -> list[list[float]]:
    """Generate embeddings for a list of texts using OpenAI."""
    async with httpx.AsyncClient(timeout=60.0) as client:
        resp = await client.post(
            OPENAI_EMBED_URL,
            json={"model": model, "input": texts, "dimensions": dimensions},
            headers={"Content-Type": "application/json", "Authorization": f"Bearer {api_key}"},
        )
    if resp.status_code != 200:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail=f"OpenAI embedding error {resp.status_code}: {resp.text[:300]}",
        )
    data = resp.json()
    return [item["embedding"] for item in data["data"]]


def _pinecone_response_dict(result: Any) -> dict:
    if isinstance(result, dict):
        return result
    if hasattr(result, "to_dict"):
        payload = result.to_dict()
        return payload if isinstance(payload, dict) else {}
    return {}


def _pinecone_field(result: Any, name: str, default: Any = None) -> Any:
    payload = _pinecone_response_dict(result)
    value = payload.get(name)
    if value is not None:
        return value
    return getattr(result, name, default)


@lru_cache(maxsize=8)
def _describe_pinecone_index(api_key: str, index_name: str) -> dict[str, Any]:
    """Return stable runtime metadata for a Pinecone index.

    The description supplies the authoritative host and vector dimension. It is
    cached per process so production data operations do not repeatedly call the
    control plane.
    """
    if not index_name:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Pinecone index name not configured",
        )
    try:
        from pinecone import Pinecone

        description = Pinecone(api_key=api_key).describe_index(name=index_name)
        host = str(_pinecone_field(description, "host", "")).strip()
        dimension = int(_pinecone_field(description, "dimension", 0) or 0)
        if host.startswith("https://"):
            host = host.removeprefix("https://")
        host = host.rstrip("/")
        if not host or dimension <= 0:
            raise ValueError("Pinecone index description omitted host or dimension")
        return {"host": host, "dimension": dimension}
    except HTTPException:
        raise
    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail=f"Pinecone index description error: {str(exc)[:300]}",
        ) from exc


async def _pinecone_runtime_config(settings: Any) -> tuple[str, int]:
    """Resolve the effective Pinecone host and embedding dimension."""
    discovered: dict[str, Any] = {}
    if settings.pinecone_api_key and settings.pinecone_index_name:
        try:
            discovered = await asyncio.to_thread(
                _describe_pinecone_index,
                settings.pinecone_api_key,
                settings.pinecone_index_name,
            )
        except HTTPException:
            if not settings.pinecone_host:
                raise
            logger.warning("Pinecone index discovery failed; using configured host and dimension")

    host = discovered.get("host") or settings.pinecone_host
    dimension = int(discovered.get("dimension") or settings.pinecone_dimension)
    if not host:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Pinecone host could not be resolved",
        )
    if dimension <= 0:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Pinecone vector dimension could not be resolved",
        )
    return host, dimension


def _pinecone_sdk_index(api_key: str, index_name: str) -> Any:
    """Build a Pinecone index client that discovers the provider host by name."""
    if not index_name:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Pinecone index name not configured",
        )
    try:
        from pinecone import Pinecone

        return Pinecone(api_key=api_key).Index(index_name)
    except HTTPException:
        raise
    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail=f"Pinecone index initialization error: {str(exc)[:300]}",
        ) from exc


async def _pinecone_upsert(
    vectors: list[dict],
    host: str,
    api_key: str,
    namespace: str,
    index_name: str = "",
    batch_size: int = 100,
) -> None:
    """Upsert vectors using a configured host or SDK index-name discovery."""
    if host:
        async with httpx.AsyncClient(timeout=60.0) as client:
            for i in range(0, len(vectors), batch_size):
                batch = vectors[i : i + batch_size]
                resp = await client.post(
                    f"https://{host}/vectors/upsert",
                    json={"vectors": batch, "namespace": namespace},
                    headers={"Content-Type": "application/json", "Api-Key": api_key},
                )
                if resp.status_code != 200:
                    raise HTTPException(
                        status_code=status.HTTP_502_BAD_GATEWAY,
                        detail=f"Pinecone upsert error {resp.status_code}: {resp.text[:500]}",
                    )
        return

    def upsert_by_index_name() -> None:
        index = _pinecone_sdk_index(api_key, index_name)
        for i in range(0, len(vectors), batch_size):
            index.upsert(vectors=vectors[i : i + batch_size], namespace=namespace)

    try:
        await asyncio.to_thread(upsert_by_index_name)
    except HTTPException:
        raise
    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail=f"Pinecone upsert error: {str(exc)[:500]}",
        ) from exc


async def _pinecone_query(
    vector: list[float],
    host: str,
    api_key: str,
    namespace: str,
    top_k: int,
    index_name: str = "",
) -> list[dict]:
    """Query Pinecone using a configured host or SDK index-name discovery."""
    if host:
        async with httpx.AsyncClient(timeout=30.0) as client:
            resp = await client.post(
                f"https://{host}/query",
                json={"vector": vector, "topK": top_k, "includeMetadata": True, "namespace": namespace},
                headers={"Content-Type": "application/json", "Api-Key": api_key},
            )
        if resp.status_code != 200:
            raise HTTPException(
                status_code=status.HTTP_502_BAD_GATEWAY,
                detail=f"Pinecone query error {resp.status_code}: {resp.text[:500]}",
            )
        return resp.json().get("matches", [])

    def query_by_index_name() -> Any:
        index = _pinecone_sdk_index(api_key, index_name)
        return index.query(
            vector=vector,
            namespace=namespace,
            top_k=top_k,
            include_metadata=True,
        )

    try:
        result = await asyncio.to_thread(query_by_index_name)
    except HTTPException:
        raise
    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail=f"Pinecone query error: {str(exc)[:500]}",
        ) from exc
    return _pinecone_response_dict(result).get("matches", [])


async def _pinecone_delete(
    filename: str,
    host: str,
    api_key: str,
    namespace: str,
    index_name: str = "",
) -> None:
    """Delete filename-scoped vectors using host REST or index-name discovery."""
    vector_filter = {"filename": {"$eq": filename}}
    if host:
        async with httpx.AsyncClient(timeout=30.0) as client:
            resp = await client.post(
                f"https://{host}/vectors/delete",
                json={"filter": vector_filter, "namespace": namespace},
                headers={"Content-Type": "application/json", "Api-Key": api_key},
            )
        if resp.status_code not in (200, 204):
            raise HTTPException(
                status_code=status.HTTP_502_BAD_GATEWAY,
                detail=f"Pinecone delete error {resp.status_code}: {resp.text[:500]}",
            )
        return

    def delete_by_index_name() -> None:
        index = _pinecone_sdk_index(api_key, index_name)
        index.delete(filter=vector_filter, namespace=namespace)

    try:
        await asyncio.to_thread(delete_by_index_name)
    except HTTPException:
        raise
    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail=f"Pinecone delete error: {str(exc)[:500]}",
        ) from exc


def _pinecone_configured(settings: Any) -> bool:
    return bool(
        settings.pinecone_api_key
        and (settings.pinecone_host or settings.pinecone_index_name)
    )


# ─── Routes ───────────────────────────────────────────────────────────────────

@router.post(
    "/rag/ingest",
    response_model=RAGIngestResponse,
    summary="RAG Document Ingest",
    description="Embed document chunks and upsert to Pinecone. Chunks are pre-computed by the frontend.",
)
async def rag_ingest(
    request: RAGIngestRequest,
    user_id: str = Depends(get_current_user_id),
    _rate: None = Depends(rate_limit(10)),
) -> RAGIngestResponse:
    settings = get_settings()

    if not settings.openai_api_key or not _pinecone_configured(settings):
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="RAG service not configured (OpenAI key plus Pinecone key and host/index required)",
        )

    try:
        pinecone_host, pinecone_dimension = await _pinecone_runtime_config(settings)
        texts = [chunk.text for chunk in request.chunks]
        batch_size = settings.embed_batch_size
        all_embeddings: list[list[float]] = []

        for i in range(0, len(texts), batch_size):
            batch = texts[i : i + batch_size]
            embeddings = await _embed_texts(
                batch,
                settings.openai_api_key,
                settings.embedding_model,
                pinecone_dimension,
            )
            all_embeddings.extend(embeddings)

        vectors = [
            {
                "id": chunk.id,
                "values": all_embeddings[idx],
                "metadata": {
                    "text": chunk.text,
                    **chunk.metadata.model_dump(),
                    "userId": user_id,
                },
            }
            for idx, chunk in enumerate(request.chunks)
        ]

        await _pinecone_upsert(
            vectors,
            pinecone_host,
            settings.pinecone_api_key,
            settings.pinecone_namespace,
            settings.pinecone_index_name,
        )

        logger.info("rag_ingest chunks=%d dimension=%d", len(request.chunks), pinecone_dimension)
        return RAGIngestResponse(success=True, chunksIngested=len(request.chunks), filename=request.filename)

    except HTTPException:
        raise
    except Exception as exc:
        logger.error("rag_ingest failed")
        return RAGIngestResponse(success=False, chunksIngested=0, filename=request.filename, error=str(exc))


@router.post(
    "/rag/retrieve",
    response_model=RAGRetrieveResponse,
    summary="RAG Context Retrieval",
    description="Embed a query and retrieve the top-K most relevant document chunks from Pinecone.",
)
async def rag_retrieve(
    request: RAGRetrieveRequest,
    user_id: str = Depends(get_current_user_id),
    _rate: None = Depends(rate_limit(60)),
) -> RAGRetrieveResponse:
    settings = get_settings()

    if not settings.openai_api_key or not _pinecone_configured(settings):
        return RAGRetrieveResponse(results=[], query=request.query)

    try:
        pinecone_host, pinecone_dimension = await _pinecone_runtime_config(settings)
        [query_embedding] = await _embed_texts(
            [request.query],
            settings.openai_api_key,
            settings.embedding_model,
            pinecone_dimension,
        )

        matches = await _pinecone_query(
            query_embedding,
            pinecone_host,
            settings.pinecone_api_key,
            settings.pinecone_namespace,
            request.topK,
            settings.pinecone_index_name,
        )

        results = [
            RetrievedContext(
                text=m.get("metadata", {}).get("text", ""),
                source=m.get("metadata", {}).get("source", "unknown"),
                score=m.get("score", 0.0),
            )
            for m in matches
            if m.get("score", 0.0) >= request.minScore
        ]

        logger.info("rag_retrieve results=%d", len(results))
        return RAGRetrieveResponse(results=results, query=request.query)

    except HTTPException:
        raise
    except Exception as exc:
        logger.error("rag_retrieve failed")
        return RAGRetrieveResponse(results=[], query=request.query)


@router.post(
    "/rag/delete",
    summary="RAG Document Delete",
    description="Delete all vectors for a specific filename from Pinecone.",
)
async def rag_delete(
    request: RAGDeleteRequest,
    user_id: str = Depends(get_current_user_id),
    _rate: None = Depends(rate_limit(10)),
) -> dict:
    settings = get_settings()

    if not _pinecone_configured(settings):
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Pinecone not configured (API key plus host or index required)",
        )

    pinecone_host, _ = await _pinecone_runtime_config(settings)
    await _pinecone_delete(
        request.filename,
        pinecone_host,
        settings.pinecone_api_key,
        settings.pinecone_namespace,
        settings.pinecone_index_name,
    )

    logger.info("rag_delete completed")
    return {"success": True, "filename": request.filename}
