"""
backend/rag/router.py — Protected RAG upload/query endpoints for Devonn.ai.
"""
from __future__ import annotations

from typing import Any

from fastapi import APIRouter, Depends, File, HTTPException, Query, UploadFile, status
from pydantic import BaseModel, Field

from backend.auth.supabase_jwt import OCCPrincipal, require_occ_access
from backend.operator.occ_logger import log_error, log_rag_document
from backend.rag.ingestion import RAGIngestionError, ingest_upload, query_rag, utc_now_iso
from backend.rag.pinecone_client import DevonnPineconeClient, namespace_for_user

router = APIRouter(prefix="/api/rag", tags=["rag"])


class RAGQueryResponse(BaseModel):
    query: str
    namespace: str
    top_k: int
    results: list[dict[str, Any]] = Field(default_factory=list)


class RAGUploadResponse(BaseModel):
    document_id: str
    filename: str
    file_type: str
    file_size_bytes: int
    namespace: str
    chunk_count: int
    vector_count: int
    status: str


@router.post("/upload", response_model=RAGUploadResponse)
async def upload_document(
    file: UploadFile = File(...),
    principal: OCCPrincipal = Depends(require_occ_access),
):
    """Upload and index a document for semantic retrieval."""
    try:
        result = await ingest_upload(file, user_id=principal.user_id)
        return RAGUploadResponse(**result.__dict__)
    except RAGIngestionError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc))
    except Exception as exc:
        await log_error(
            error_type="rag_upload_unhandled",
            message=str(exc),
            severity="error",
            service="rag",
            endpoint="/api/rag/upload",
            user_id=principal.user_id,
        )
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Document upload failed. The incident has been logged.",
        )


@router.get("/query", response_model=RAGQueryResponse)
async def query_documents(
    q: str = Query(..., min_length=1, description="Semantic search query"),
    top_k: int = Query(5, ge=1, le=20),
    principal: OCCPrincipal = Depends(require_occ_access),
):
    """Run semantic search against the authenticated user's RAG namespace."""
    try:
        payload = await query_rag(q, user_id=principal.user_id, top_k=top_k)
        return RAGQueryResponse(**payload)
    except RAGIngestionError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc))
    except Exception as exc:
        await log_error(
            error_type="rag_query_unhandled",
            message=str(exc),
            severity="error",
            service="rag",
            endpoint="/api/rag/query",
            user_id=principal.user_id,
        )
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="RAG query failed. The incident has been logged.",
        )


@router.delete("/documents/{document_id}")
async def delete_document(
    document_id: str,
    principal: OCCPrincipal = Depends(require_occ_access),
):
    """Delete all Pinecone vectors for a document in the authenticated namespace."""
    namespace = namespace_for_user(principal.user_id)
    try:
        client = DevonnPineconeClient()
        result = await client.delete_document_vectors(document_id, namespace=namespace)
        await log_rag_document(
            title=document_id,
            status="deleted",
            namespace=namespace,
            uploaded_by=principal.user_id,
            indexed_at=utc_now_iso(),
            metadata={"document_id": document_id, "delete_result": result},
        )
        return {"status": "deleted", "document_id": document_id, "namespace": namespace}
    except Exception as exc:
        await log_error(
            error_type="rag_delete_failed",
            message=str(exc),
            severity="error",
            service="rag",
            endpoint=f"/api/rag/documents/{document_id}",
            user_id=principal.user_id,
            metadata={"document_id": document_id},
        )
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Document delete failed. The incident has been logged.",
        )


@router.get("/documents")
async def list_documents(
    principal: OCCPrincipal = Depends(require_occ_access),
):
    """
    Placeholder listing endpoint.

    The OCC panel reads rag_documents from Supabase. This endpoint confirms the
    active namespace and can be expanded later to proxy Supabase document rows.
    """
    return {
        "status": "ok",
        "namespace": namespace_for_user(principal.user_id),
        "message": "RAG document records are available through /api/occ/rag-docs.",
    }


@router.get("/health")
async def rag_health(_: OCCPrincipal = Depends(require_occ_access)):
    """Protected RAG service health check."""
    client = DevonnPineconeClient()
    pinecone = await client.health_check_pinecone()
    return {"status": "ok", "pinecone": pinecone}
