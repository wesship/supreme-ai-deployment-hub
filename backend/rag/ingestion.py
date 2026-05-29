"""
backend/rag/ingestion.py — Devonn.ai document ingestion and semantic retrieval.

Pipeline:
file upload -> validation -> text extraction -> chunking -> OpenAI embeddings ->
Pinecone upsert -> OCC rag_documents status logging.
"""
from __future__ import annotations

import hashlib
import os
import time
import uuid
from dataclasses import dataclass
from datetime import datetime, timezone
from typing import Any

import httpx
from fastapi import UploadFile

from backend.operator.occ_logger import log_error, log_rag_document
from backend.rag.pinecone_client import DevonnPineconeClient, VectorRecord, namespace_for_user

EMBEDDING_MODEL = os.getenv("OPENAI_EMBEDDING_MODEL", "text-embedding-3-small")
OPENAI_API_KEY = os.getenv("OPENAI_API_KEY", "")
MAX_FILE_SIZE_BYTES = int(os.getenv("RAG_MAX_FILE_SIZE_BYTES", str(10 * 1024 * 1024)))
MAX_CHUNK_CHARS = int(os.getenv("RAG_CHUNK_SIZE_CHARS", "1400"))
CHUNK_OVERLAP_CHARS = int(os.getenv("RAG_CHUNK_OVERLAP_CHARS", "180"))
SUPPORTED_EXTENSIONS = {".txt", ".md", ".markdown", ".csv", ".json", ".html", ".htm"}


class RAGIngestionError(RuntimeError):
    """Raised for safe, user-facing RAG ingestion failures."""


@dataclass(frozen=True)
class TextChunk:
    index: int
    text: str
    start_char: int
    end_char: int


@dataclass(frozen=True)
class IngestionResult:
    document_id: str
    filename: str
    file_type: str
    file_size_bytes: int
    namespace: str
    chunk_count: int
    vector_count: int
    status: str


def utc_now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def extension_for(filename: str) -> str:
    _, ext = os.path.splitext(filename.lower())
    return ext


def validate_upload(filename: str, file_size_bytes: int) -> None:
    """Validate file type and size before processing."""
    ext = extension_for(filename)
    if ext not in SUPPORTED_EXTENSIONS:
        raise RAGIngestionError(
            f"Unsupported file type '{ext or 'unknown'}'. Supported: {', '.join(sorted(SUPPORTED_EXTENSIONS))}"
        )
    if file_size_bytes <= 0:
        raise RAGIngestionError("Uploaded file is empty.")
    if file_size_bytes > MAX_FILE_SIZE_BYTES:
        raise RAGIngestionError(
            f"File is too large. Max size is {MAX_FILE_SIZE_BYTES} bytes."
        )


def extract_text_from_bytes(content: bytes, filename: str) -> str:
    """Extract text from currently supported text-like formats."""
    validate_upload(filename, len(content))
    try:
        text = content.decode("utf-8")
    except UnicodeDecodeError:
        text = content.decode("latin-1", errors="ignore")
    text = text.replace("\x00", "").strip()
    if not text:
        raise RAGIngestionError("No readable text could be extracted from this file.")
    return text


def chunk_text(
    text: str,
    *,
    max_chars: int = MAX_CHUNK_CHARS,
    overlap_chars: int = CHUNK_OVERLAP_CHARS,
) -> list[TextChunk]:
    """Chunk text into overlapping character windows with paragraph-aware boundaries."""
    clean = "\n".join(line.rstrip() for line in text.splitlines()).strip()
    if not clean:
        return []
    if max_chars <= 0:
        raise ValueError("max_chars must be positive")
    if overlap_chars < 0 or overlap_chars >= max_chars:
        raise ValueError("overlap_chars must be >= 0 and smaller than max_chars")

    chunks: list[TextChunk] = []
    start = 0
    idx = 0
    text_len = len(clean)

    while start < text_len:
        hard_end = min(start + max_chars, text_len)
        end = hard_end
        if hard_end < text_len:
            boundary = clean.rfind("\n\n", start, hard_end)
            if boundary == -1 or boundary <= start + int(max_chars * 0.45):
                boundary = clean.rfind(". ", start, hard_end)
                if boundary != -1:
                    boundary += 1
            if boundary != -1 and boundary > start:
                end = boundary

        chunk = clean[start:end].strip()
        if chunk:
            chunks.append(TextChunk(index=idx, text=chunk, start_char=start, end_char=end))
            idx += 1

        if end >= text_len:
            break
        start = max(0, end - overlap_chars)

    return chunks


async def create_embeddings(texts: list[str], *, model: str = EMBEDDING_MODEL) -> list[list[float]]:
    """Create embeddings with OpenAI's embeddings API."""
    if not OPENAI_API_KEY:
        raise RAGIngestionError("OPENAI_API_KEY is not configured.")
    if not texts:
        return []

    async with httpx.AsyncClient(timeout=60.0) as client:
        resp = await client.post(
            "https://api.openai.com/v1/embeddings",
            headers={
                "Authorization": f"Bearer {OPENAI_API_KEY}",
                "Content-Type": "application/json",
            },
            json={"model": model, "input": texts},
        )
    if resp.status_code >= 400:
        raise RAGIngestionError(f"OpenAI embeddings failed: {resp.status_code} {resp.text[:300]}")
    payload = resp.json()
    data = sorted(payload.get("data", []), key=lambda item: item.get("index", 0))
    embeddings = [item["embedding"] for item in data]
    if len(embeddings) != len(texts):
        raise RAGIngestionError("Embedding count did not match chunk count.")
    return embeddings


def build_document_id(filename: str, content: bytes) -> str:
    digest = hashlib.sha256(content).hexdigest()[:16]
    return f"doc_{digest}_{uuid.uuid4().hex[:8]}"


def build_vector_records(
    *,
    document_id: str,
    filename: str,
    file_type: str,
    chunks: list[TextChunk],
    embeddings: list[list[float]],
    namespace: str,
    user_id: str | None,
    tenant_id: str | None,
) -> list[VectorRecord]:
    records: list[VectorRecord] = []
    created_at = utc_now_iso()
    for chunk, embedding in zip(chunks, embeddings):
        # Pinecone rejects None/null metadata values — strip them out before upsert
        raw_metadata = {
            "document_id": document_id,
            "filename": filename,
            "file_type": file_type,
            "chunk_index": chunk.index,
            "text": chunk.text,
            "start_char": chunk.start_char,
            "end_char": chunk.end_char,
            "namespace": namespace,
            "user_id": user_id or "",
            "tenant_id": tenant_id or "",
            "created_at": created_at,
        }
        # Remove any keys with None values to prevent Pinecone 400 errors
        metadata = {k: v for k, v in raw_metadata.items() if v is not None}
        records.append(
            VectorRecord(
                id=f"{document_id}:chunk:{chunk.index}",
                values=embedding,
                metadata=metadata,
            )
        )
    return records


async def ingest_upload(
    upload: UploadFile,
    *,
    user_id: str | None,
    tenant_id: str | None = None,
    pinecone_client: DevonnPineconeClient | None = None,
) -> IngestionResult:
    """Ingest one uploaded file into Pinecone and log status into OCC."""
    filename = upload.filename or "uploaded-document.txt"
    content = await upload.read()
    file_size = len(content)
    file_type = extension_for(filename).lstrip(".") or "txt"
    document_id = build_document_id(filename, content)
    namespace = namespace_for_user(user_id, tenant_id)
    started = time.monotonic()

    await log_rag_document(
        title=filename,
        file_name=filename,
        file_type=file_type,
        file_size_bytes=file_size,
        status="processing",
        chunk_count=0,
        embedding_model=EMBEDDING_MODEL,
        namespace=namespace,
        uploaded_by=user_id,
        tenant_id=tenant_id,
        metadata={"document_id": document_id},
    )

    try:
        text = extract_text_from_bytes(content, filename)
        chunks = chunk_text(text)
        if not chunks:
            raise RAGIngestionError("No searchable chunks were created from this document.")

        embeddings = await create_embeddings([chunk.text for chunk in chunks])
        records = build_vector_records(
            document_id=document_id,
            filename=filename,
            file_type=file_type,
            chunks=chunks,
            embeddings=embeddings,
            namespace=namespace,
            user_id=user_id,
            tenant_id=tenant_id,
        )
        client = pinecone_client or DevonnPineconeClient()
        await client.upsert_vectors(records, namespace=namespace)

        await log_rag_document(
            title=filename,
            file_name=filename,
            file_type=file_type,
            file_size_bytes=file_size,
            status="indexed",
            chunk_count=len(chunks),
            embedding_model=EMBEDDING_MODEL,
            namespace=namespace,
            uploaded_by=user_id,
            tenant_id=tenant_id,
            indexed_at=utc_now_iso(),
            metadata={
                "document_id": document_id,
                "vector_count": len(records),
                "latency_ms": int((time.monotonic() - started) * 1000),
            },
        )
        return IngestionResult(
            document_id=document_id,
            filename=filename,
            file_type=file_type,
            file_size_bytes=file_size,
            namespace=namespace,
            chunk_count=len(chunks),
            vector_count=len(records),
            status="indexed",
        )
    except Exception as exc:
        await log_rag_document(
            title=filename,
            file_name=filename,
            file_type=file_type,
            file_size_bytes=file_size,
            status="failed",
            chunk_count=0,
            embedding_model=EMBEDDING_MODEL,
            namespace=namespace,
            uploaded_by=user_id,
            tenant_id=tenant_id,
            error_message=str(exc),
            metadata={"document_id": document_id},
        )
        await log_error(
            error_type="rag_ingestion_failed",
            message=str(exc),
            severity="error",
            service="rag",
            endpoint="/api/rag/upload",
            user_id=user_id,
            tenant_id=tenant_id,
            metadata={"filename": filename, "document_id": document_id},
        )
        raise


async def query_rag(
    query: str,
    *,
    user_id: str | None,
    tenant_id: str | None = None,
    top_k: int = 5,
    pinecone_client: DevonnPineconeClient | None = None,
) -> dict[str, Any]:
    """Embed a query and retrieve matching document chunks from Pinecone."""
    clean_query = query.strip()
    if not clean_query:
        raise RAGIngestionError("Query cannot be empty.")
    namespace = namespace_for_user(user_id, tenant_id)
    embedding = (await create_embeddings([clean_query]))[0]
    client = pinecone_client or DevonnPineconeClient()
    result = await client.query_vectors(embedding, namespace=namespace, top_k=max(1, min(top_k, 20)))
    return {"query": clean_query, "namespace": namespace, "top_k": top_k, "results": result.get("matches", [])}
