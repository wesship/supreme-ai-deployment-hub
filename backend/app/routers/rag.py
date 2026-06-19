"""
Devonn.ai Backend Proxy — /api/rag
RAG pipeline: document ingestion, context retrieval, and deletion.
Uses OpenAI for embeddings and Pinecone for vector storage.
All API keys are server-side only.
"""
import logging

import httpx
from fastapi import APIRouter, Depends, HTTPException, status

from app.config import get_settings
from app.middleware.auth import get_current_user_id
from app.middleware.rate_limit import rate_limit
from app.models.proxy import (
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


async def _pinecone_upsert(
    vectors: list[dict],
    host: str,
    api_key: str,
    namespace: str,
    batch_size: int = 100,
) -> None:
    """Upsert vectors to Pinecone in batches."""
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
                    detail=f"Pinecone upsert error {resp.status_code}: {resp.text[:300]}",
                )


async def _pinecone_query(
    vector: list[float],
    host: str,
    api_key: str,
    namespace: str,
    top_k: int,
) -> list[dict]:
    """Query Pinecone for nearest neighbors."""
    async with httpx.AsyncClient(timeout=30.0) as client:
        resp = await client.post(
            f"https://{host}/query",
            json={"vector": vector, "topK": top_k, "includeMetadata": True, "namespace": namespace},
            headers={"Content-Type": "application/json", "Api-Key": api_key},
        )
    if resp.status_code != 200:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail=f"Pinecone query error {resp.status_code}: {resp.text[:300]}",
        )
    return resp.json().get("matches", [])


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

    if not settings.openai_api_key or not settings.pinecone_api_key or not settings.pinecone_host:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="RAG service not configured (OPENAI_API_KEY, PINECONE_API_KEY, or PINECONE_HOST missing)",
        )

    try:
        texts = [chunk.text for chunk in request.chunks]
        batch_size = settings.embed_batch_size
        all_embeddings: list[list[float]] = []

        for i in range(0, len(texts), batch_size):
            batch = texts[i : i + batch_size]
            embeddings = await _embed_texts(
                batch,
                settings.openai_api_key,
                settings.embedding_model,
                settings.pinecone_dimension,
            )
            all_embeddings.extend(embeddings)

        vectors = [
            {
                "id": chunk.id,
                "values": all_embeddings[idx],
                "metadata": {
                    "text": chunk.text,
                    **chunk.metadata.model_dump(),
                    "userId": user_id,  # override with authenticated user ID
                },
            }
            for idx, chunk in enumerate(request.chunks)
        ]

        await _pinecone_upsert(
            vectors,
            settings.pinecone_host,
            settings.pinecone_api_key,
            settings.pinecone_namespace,
        )

        logger.info("rag_ingest user=%s filename=%s chunks=%d", user_id, request.filename, len(request.chunks))
        return RAGIngestResponse(success=True, chunksIngested=len(request.chunks), filename=request.filename)

    except HTTPException:
        raise
    except Exception as exc:
        logger.exception("rag_ingest error: %s", exc)
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

    if not settings.openai_api_key or not settings.pinecone_api_key or not settings.pinecone_host:
        # Return empty results gracefully — don't break chat
        return RAGRetrieveResponse(results=[], query=request.query)

    try:
        [query_embedding] = await _embed_texts(
            [request.query],
            settings.openai_api_key,
            settings.embedding_model,
            settings.pinecone_dimension,
        )

        matches = await _pinecone_query(
            query_embedding,
            settings.pinecone_host,
            settings.pinecone_api_key,
            settings.pinecone_namespace,
            request.topK,
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

        logger.info("rag_retrieve user=%s results=%d", user_id, len(results))
        return RAGRetrieveResponse(results=results, query=request.query)

    except HTTPException:
        raise
    except Exception as exc:
        logger.exception("rag_retrieve error: %s", exc)
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

    if not settings.pinecone_api_key or not settings.pinecone_host:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Pinecone not configured",
        )

    async with httpx.AsyncClient(timeout=30.0) as client:
        resp = await client.post(
            f"https://{settings.pinecone_host}/vectors/delete",
            json={
                "filter": {"filename": {"$eq": request.filename}},
                "namespace": settings.pinecone_namespace,
            },
            headers={"Content-Type": "application/json", "Api-Key": settings.pinecone_api_key},
        )

    if resp.status_code not in (200, 204):
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail=f"Pinecone delete error {resp.status_code}: {resp.text[:300]}",
        )

    logger.info("rag_delete user=%s filename=%s", user_id, request.filename)
    return {"success": True, "filename": request.filename}
