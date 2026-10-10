"""Production-safe DKOS document preprocessing worker.

This module performs the stages that can be executed truthfully inside the
worker image today and reports unavailable downstream capabilities instead of
marking placeholder work as completed.

Configured execution:
  security scan -> classification -> optional Docling -> MarkItDown ->
  Markdown cleanup -> metadata -> semantic chunks

Downstream stages (knowledge graph, embeddings, Pinecone, Hermes memory) remain
explicitly blocked until their runtime adapters/capabilities are configured.
"""

from __future__ import annotations

import hashlib
import json
import os
import re
import urllib.error
import urllib.request
from dataclasses import asdict, dataclass, field
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Literal
from uuid import uuid4

Stage = Literal[
    "security_scan",
    "file_classification",
    "ocr",
    "docling",
    "markitdown",
    "markdown_cleanup",
    "metadata_extraction",
    "knowledge_graph",
    "semantic_chunking",
    "embeddings",
    "pinecone_storage",
    "hermes_memory",
]

Status = Literal["pending", "running", "completed", "failed", "manual_review"]
StageStatus = Literal["pending", "running", "completed", "skipped", "blocked", "failed"]

PIPELINE: list[Stage] = [
    "security_scan",
    "file_classification",
    "ocr",
    "docling",
    "markitdown",
    "markdown_cleanup",
    "metadata_extraction",
    "knowledge_graph",
    "semantic_chunking",
    "embeddings",
    "pinecone_storage",
    "hermes_memory",
]

_BLOCKED_EXTENSIONS = {".exe", ".dll", ".bat", ".cmd", ".com", ".scr", ".msi"}
_TEXT_SUFFIXES = {".txt", ".md", ".markdown", ".csv", ".json", ".xml", ".html", ".htm"}
_MAX_BYTES_DEFAULT = 100 * 1024 * 1024


@dataclass
class Artifact:
    kind: str
    path: str
    content_type: str
    sha256: str | None = None


@dataclass
class StageState:
    stage: str
    status: StageStatus = "pending"
    started_at: str | None = None
    completed_at: str | None = None
    detail: str | None = None


@dataclass
class IngestionJob:
    source_path: Path
    tenant_id: str
    uploaded_by: str
    classification: str = "internal"
    profile_id: str | None = None
    source_id: str | None = None
    run_id: str = field(default_factory=lambda: str(uuid4()))
    document_id: str = field(default_factory=lambda: str(uuid4()))


@dataclass
class IngestionResult:
    run_id: str
    document_id: str
    status: Status
    current_stage: str
    artifacts: list[Artifact]
    stages: list[StageState]
    completed_at: str
    source_sha256: str


def now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def file_sha256(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as handle:
        for block in iter(lambda: handle.read(1024 * 1024), b""):
            digest.update(block)
    return digest.hexdigest()


def artifact(kind: str, path: Path, content_type: str) -> Artifact:
    return Artifact(kind, str(path), content_type, file_sha256(path))


def _max_bytes() -> int:
    raw = os.getenv("DKOS_MAX_UPLOAD_BYTES", "").strip()
    if not raw:
        return _MAX_BYTES_DEFAULT
    try:
        value = int(raw)
    except ValueError as exc:
        raise RuntimeError("DKOS_MAX_UPLOAD_BYTES must be an integer") from exc
    if value <= 0:
        raise RuntimeError("DKOS_MAX_UPLOAD_BYTES must be positive")
    return value


def security_scan(job: IngestionJob) -> None:
    path = job.source_path
    if not path.exists() or not path.is_file():
        raise FileNotFoundError(f"Source file not found: {path}")
    size = path.stat().st_size
    if size <= 0:
        raise ValueError("Source file is empty")
    if size > _max_bytes():
        raise ValueError(f"Source file exceeds DKOS_MAX_UPLOAD_BYTES ({size} bytes)")
    if path.suffix.lower() in _BLOCKED_EXTENSIONS:
        raise ValueError(f"Executable file type is not accepted: {path.suffix.lower()}")


def file_classification(job: IngestionJob) -> str:
    return job.source_path.suffix.lower().lstrip(".") or "unknown"


def run_docling(job: IngestionJob, output_dir: Path) -> Path | None:
    """Run Docling only when explicitly enabled and installed.

    Docling is intentionally optional because the current slim worker image does
    not install it. Enabling the environment flag without the package fails
    closed instead of generating a placeholder artifact.
    """
    if os.getenv("DKOS_ENABLE_DOCLING", "false").lower() not in {"1", "true", "yes"}:
        return None

    try:
        from docling.document_converter import DocumentConverter
    except ImportError as exc:
        raise RuntimeError("DKOS_ENABLE_DOCLING is true but docling is not installed") from exc

    converter = DocumentConverter()
    result = converter.convert(str(job.source_path))
    markdown = result.document.export_to_markdown()
    output_path = output_dir / "docling.md"
    output_path.write_text(markdown, encoding="utf-8")
    return output_path


def run_markitdown(job: IngestionJob, output_dir: Path) -> Path:
    """Convert the source using the real MarkItDown package."""
    try:
        from markitdown import MarkItDown
    except ImportError as exc:
        raise RuntimeError("markitdown is not installed in the DKOS worker image") from exc

    converter = MarkItDown()
    result = converter.convert(str(job.source_path))
    text = getattr(result, "text_content", None)
    if not isinstance(text, str) or not text.strip():
        raise RuntimeError("MarkItDown produced no textual content")

    output_path = output_dir / "document.raw.md"
    output_path.write_text(text, encoding="utf-8")
    return output_path


def cleanup_markdown(raw_path: Path, output_dir: Path) -> Path:
    text = raw_path.read_text(encoding="utf-8", errors="replace")
    text = text.replace("\r\n", "\n").replace("\r", "\n")
    text = re.sub(r"[ \t]+\n", "\n", text)
    text = re.sub(r"\n{4,}", "\n\n\n", text)
    text = text.strip()
    if not text:
        raise RuntimeError("Markdown cleanup produced an empty document")
    output_path = output_dir / "document.md"
    output_path.write_text(text + "\n", encoding="utf-8")
    return output_path


def create_metadata(
    job: IngestionJob,
    source_type: str,
    source_sha256: str,
    markdown_path: Path,
    output_dir: Path,
) -> Path:
    payload = {
        "run_id": job.run_id,
        "document_id": job.document_id,
        "source_filename": job.source_path.name,
        "source_type": source_type,
        "source_sha256": source_sha256,
        "source_bytes": job.source_path.stat().st_size,
        "markdown_sha256": file_sha256(markdown_path),
        "tenant_id": job.tenant_id,
        "uploaded_by": job.uploaded_by,
        "classification": job.classification,
        "profile_id": job.profile_id,
        "source_id": job.source_id,
        "created_at": now_iso(),
    }
    output_path = output_dir / "source_metadata.json"
    output_path.write_text(json.dumps(payload, indent=2, sort_keys=True) + "\n", encoding="utf-8")
    return output_path


def _token_count(text: str) -> int:
    try:
        import tiktoken
        encoding = tiktoken.get_encoding("cl100k_base")
        return len(encoding.encode(text))
    except Exception:
        # Deterministic fallback used only when tokenizer data is unavailable.
        return max(1, len(text.split()))


def semantic_chunks(
    markdown_path: Path,
    output_dir: Path,
    *,
    max_tokens: int = 800,
) -> Path:
    """Create deterministic paragraph-aware chunks suitable for embedding."""
    text = markdown_path.read_text(encoding="utf-8")
    paragraphs = [part.strip() for part in re.split(r"\n\s*\n", text) if part.strip()]
    if not paragraphs:
        raise RuntimeError("No semantic content available for chunking")

    chunks: list[dict] = []
    buffer: list[str] = []
    buffer_tokens = 0

    def flush() -> None:
        nonlocal buffer, buffer_tokens
        if not buffer:
            return
        body = "\n\n".join(buffer).strip()
        chunk_index = len(chunks)
        chunks.append(
            {
                "chunk_id": f"{chunk_index:06d}",
                "index": chunk_index,
                "text": body,
                "token_count": _token_count(body),
                "sha256": hashlib.sha256(body.encode("utf-8")).hexdigest(),
            }
        )
        buffer = []
        buffer_tokens = 0

    for paragraph in paragraphs:
        paragraph_tokens = _token_count(paragraph)
        if buffer and buffer_tokens + paragraph_tokens > max_tokens:
            flush()
        if paragraph_tokens > max_tokens:
            # Preserve deterministic progress for very large single paragraphs.
            words = paragraph.split()
            word_buffer: list[str] = []
            for word in words:
                candidate = " ".join([*word_buffer, word])
                if word_buffer and _token_count(candidate) > max_tokens:
                    body = " ".join(word_buffer)
                    idx = len(chunks)
                    chunks.append(
                        {
                            "chunk_id": f"{idx:06d}",
                            "index": idx,
                            "text": body,
                            "token_count": _token_count(body),
                            "sha256": hashlib.sha256(body.encode("utf-8")).hexdigest(),
                        }
                    )
                    word_buffer = [word]
                else:
                    word_buffer.append(word)
            if word_buffer:
                buffer = [" ".join(word_buffer)]
                buffer_tokens = _token_count(buffer[0])
        else:
            buffer.append(paragraph)
            buffer_tokens += paragraph_tokens
    flush()

    output_path = output_dir / "chunks.jsonl"
    with output_path.open("w", encoding="utf-8") as handle:
        for chunk in chunks:
            handle.write(json.dumps(chunk, ensure_ascii=False) + "\n")
    return output_path


def _read_chunks(chunks_path: Path) -> list[dict[str, Any]]:
    rows: list[dict[str, Any]] = []
    for line in chunks_path.read_text(encoding="utf-8").splitlines():
        if line.strip():
            rows.append(json.loads(line))
    if not rows:
        raise RuntimeError("No chunks available for embedding")
    return rows


def embedding_capability() -> bool:
    return bool(os.getenv("OPENAI_API_KEY", "").strip())


def pinecone_capability() -> bool:
    return bool(
        os.getenv("PINECONE_API_KEY", "").strip()
        and os.getenv("PINECONE_INDEX", "").strip()
    )


def _embedding_model() -> str:
    return os.getenv("DKOS_EMBEDDING_MODEL", "text-embedding-3-small").strip()


def _embedding_dimensions() -> int | None:
    raw = os.getenv("DKOS_EMBEDDING_DIMENSIONS", "").strip()
    if not raw:
        return None
    value = int(raw)
    if value <= 0:
        raise RuntimeError("DKOS_EMBEDDING_DIMENSIONS must be positive")
    return value


def generate_embeddings(chunks_path: Path, output_dir: Path) -> Path:
    api_key = os.getenv("OPENAI_API_KEY", "").strip()
    if not api_key:
        raise RuntimeError("OPENAI_API_KEY is not configured")

    rows = _read_chunks(chunks_path)
    payload: dict[str, Any] = {
        "model": _embedding_model(),
        "input": [row["text"] for row in rows],
    }
    dimensions = _embedding_dimensions()
    if dimensions:
        payload["dimensions"] = dimensions

    request = urllib.request.Request(
        "https://api.openai.com/v1/embeddings",
        data=json.dumps(payload).encode("utf-8"),
        headers={
            "Authorization": f"Bearer {api_key}",
            "Content-Type": "application/json",
        },
        method="POST",
    )
    try:
        with urllib.request.urlopen(request, timeout=60) as response:
            body = json.loads(response.read().decode("utf-8"))
    except urllib.error.HTTPError as exc:
        detail = exc.read().decode("utf-8", errors="replace")[:500]
        raise RuntimeError(f"OpenAI embedding request failed ({exc.code}): {detail}") from exc
    except urllib.error.URLError as exc:
        raise RuntimeError(f"OpenAI embedding request failed: {exc}") from exc

    data = body.get("data")
    if not isinstance(data, list) or len(data) != len(rows):
        raise RuntimeError("Embedding response count did not match semantic chunks")

    output_path = output_dir / "embeddings.jsonl"
    with output_path.open("w", encoding="utf-8") as handle:
        for row, item in zip(rows, data, strict=True):
            vector = item.get("embedding") if isinstance(item, dict) else None
            if not isinstance(vector, list) or not vector:
                raise RuntimeError("Embedding response contained an empty vector")
            payload_row = {
                "chunk_id": row["chunk_id"],
                "index": row["index"],
                "sha256": row["sha256"],
                "text": row["text"],
                "values": vector,
                "dimension": len(vector),
                "model": _embedding_model(),
            }
            handle.write(json.dumps(payload_row, ensure_ascii=False) + "\n")
    return output_path


def pinecone_namespace(job: IngestionJob) -> str:
    tenant = re.sub(r"[^a-zA-Z0-9_.:-]+", "-", job.tenant_id.strip())[:120]
    if not tenant:
        raise RuntimeError("tenant_id is required for Pinecone isolation")
    return f"tenant:{tenant}"


def upsert_pinecone(job: IngestionJob, embeddings_path: Path, output_dir: Path) -> Path:
    api_key = os.getenv("PINECONE_API_KEY", "").strip()
    index_name = os.getenv("PINECONE_INDEX", "").strip()
    if not api_key or not index_name:
        raise RuntimeError("PINECONE_API_KEY and PINECONE_INDEX are required")

    try:
        from pinecone import Pinecone
    except ImportError as exc:
        raise RuntimeError("pinecone package is not installed") from exc

    rows = _read_chunks(embeddings_path)
    namespace = pinecone_namespace(job)
    vectors = [
        {
            "id": f"{job.document_id}:{row['chunk_id']}",
            "values": row["values"],
            "metadata": {
                "tenant_id": job.tenant_id,
                "document_id": job.document_id,
                "run_id": job.run_id,
                "chunk_id": row["chunk_id"],
                "chunk_sha256": row["sha256"],
                "source_filename": job.source_path.name,
                "classification": job.classification,
                "profile_id": job.profile_id,
                "source_id": job.source_id,
                "text": row["text"],
            },
        }
        for row in rows
    ]
    index = Pinecone(api_key=api_key).Index(index_name)
    for start in range(0, len(vectors), 100):
        index.upsert(vectors=vectors[start : start + 100], namespace=namespace)

    receipt = {
        "run_id": job.run_id,
        "document_id": job.document_id,
        "namespace": namespace,
        "index": index_name,
        "vector_count": len(vectors),
        "vector_ids_sha256": hashlib.sha256(
            "\n".join(vector["id"] for vector in vectors).encode("utf-8")
        ).hexdigest(),
        "completed_at": now_iso(),
    }
    output_path = output_dir / "pinecone_receipt.json"
    output_path.write_text(json.dumps(receipt, indent=2, sort_keys=True) + "\n", encoding="utf-8")
    return output_path


def create_hermes_memory_manifest(
    job: IngestionJob,
    *,
    source_sha256: str,
    chunks_path: Path,
    embeddings_path: Path,
    pinecone_receipt_path: Path,
    output_dir: Path,
) -> Path:
    chunks = _read_chunks(chunks_path)
    receipt = json.loads(pinecone_receipt_path.read_text(encoding="utf-8"))
    commit_id = hashlib.sha256(
        f"{job.tenant_id}:{job.document_id}:{source_sha256}:{file_sha256(chunks_path)}".encode("utf-8")
    ).hexdigest()
    manifest = {
        "schema": "d3vonn.hermes.memory-commit.v1",
        "commit_id": commit_id,
        "idempotency_key": commit_id,
        "tenant_id": job.tenant_id,
        "profile_id": job.profile_id,
        "source_id": job.source_id,
        "document_id": job.document_id,
        "run_id": job.run_id,
        "source_sha256": source_sha256,
        "chunk_count": len(chunks),
        "chunks_sha256": file_sha256(chunks_path),
        "embeddings_sha256": file_sha256(embeddings_path),
        "pinecone": receipt,
        "state": "ready_for_hermes_commit",
        "created_at": now_iso(),
    }
    output_path = output_dir / "hermes-memory-manifest.json"
    output_path.write_text(json.dumps(manifest, indent=2, sort_keys=True) + "\n", encoding="utf-8")
    return output_path

def commit_manifest_to_hermes(job: IngestionJob, manifest_path: Path) -> dict[str, Any]:
    if not job.profile_id or not job.source_id:
        raise RuntimeError("Client AI profile_id and source_id are required for Hermes memory commit")

    url = os.getenv("CLIENT_AI_MEMORY_COMMIT_URL", "").strip()
    secret = os.getenv("CLIENT_AI_MEMORY_COMMIT_SECRET", "").strip()
    if not url or not secret:
        raise RuntimeError("CLIENT_AI_MEMORY_COMMIT_URL and CLIENT_AI_MEMORY_COMMIT_SECRET are required")

    request = urllib.request.Request(
        url,
        data=manifest_path.read_bytes(),
        headers={
            "Content-Type": "application/json",
            "X-Client-AI-Memory-Secret": secret,
        },
        method="POST",
    )
    try:
        with urllib.request.urlopen(request, timeout=30) as response:
            payload = json.loads(response.read().decode("utf-8"))
    except urllib.error.HTTPError as exc:
        detail = exc.read().decode("utf-8", errors="replace")[:500]
        raise RuntimeError(f"Hermes memory commit failed ({exc.code}): {detail}") from exc
    except urllib.error.URLError as exc:
        raise RuntimeError(f"Hermes memory commit failed: {exc}") from exc

    if not isinstance(payload, dict) or payload.get("committed") is not True:
        raise RuntimeError("Hermes memory consumer did not confirm commit")
    return payload


def _new_stages() -> dict[str, StageState]:
    return {stage: StageState(stage=stage) for stage in PIPELINE}


def _complete(stage: StageState, detail: str | None = None) -> None:
    stage.status = "completed"
    stage.completed_at = now_iso()
    stage.detail = detail


def _start(stage: StageState) -> None:
    stage.status = "running"
    stage.started_at = now_iso()


def _block_remaining(stages: dict[str, StageState], first: str, detail: str) -> None:
    found = False
    for name in PIPELINE:
        if name == first:
            found = True
        if found and stages[name].status == "pending":
            stages[name].status = "blocked"
            stages[name].detail = detail


def run_ingestion(
    job: IngestionJob,
    output_root: Path = Path("/tmp/dkos-ingestion"),
) -> IngestionResult:
    output_dir = output_root / job.run_id
    output_dir.mkdir(parents=True, exist_ok=True)
    stages = _new_stages()
    artifacts: list[Artifact] = []
    current_stage = "security_scan"

    try:
        _start(stages["security_scan"])
        security_scan(job)
        source_sha256 = file_sha256(job.source_path)
        _complete(stages["security_scan"], f"sha256={source_sha256}")

        current_stage = "file_classification"
        _start(stages[current_stage])
        source_type = file_classification(job)
        _complete(stages[current_stage], source_type)

        stages["ocr"].status = "skipped"
        stages["ocr"].detail = "OCR is delegated to Docling/MarkItDown when required by the source format"

        current_stage = "docling"
        _start(stages[current_stage])
        docling_path = run_docling(job, output_dir)
        if docling_path is None:
            stages[current_stage].status = "skipped"
            stages[current_stage].completed_at = now_iso()
            stages[current_stage].detail = "DKOS_ENABLE_DOCLING is disabled"
        else:
            artifacts.append(artifact("docling_markdown", docling_path, "text/markdown"))
            _complete(stages[current_stage])

        current_stage = "markitdown"
        _start(stages[current_stage])
        raw_markdown = run_markitdown(job, output_dir)
        artifacts.append(artifact("raw_markdown", raw_markdown, "text/markdown"))
        _complete(stages[current_stage])

        current_stage = "markdown_cleanup"
        _start(stages[current_stage])
        markdown = cleanup_markdown(raw_markdown, output_dir)
        artifacts.append(artifact("markdown", markdown, "text/markdown"))
        _complete(stages[current_stage])

        current_stage = "metadata_extraction"
        _start(stages[current_stage])
        metadata = create_metadata(job, source_type, source_sha256, markdown, output_dir)
        artifacts.append(artifact("source_metadata", metadata, "application/json"))
        _complete(stages[current_stage])

        # Knowledge-graph extraction is not implemented in this worker yet.
        stages["knowledge_graph"].status = "blocked"
        stages["knowledge_graph"].detail = "Knowledge graph adapter not configured in this worker"

        current_stage = "semantic_chunking"
        _start(stages[current_stage])
        chunks = semantic_chunks(markdown, output_dir)
        artifacts.append(artifact("chunks", chunks, "application/jsonl"))
        _complete(stages[current_stage])

        if not embedding_capability():
            _block_remaining(
                stages,
                "embeddings",
                "OPENAI_API_KEY is not configured for DKOS embeddings",
            )
            return IngestionResult(
                run_id=job.run_id,
                document_id=job.document_id,
                status="manual_review",
                current_stage="embeddings",
                artifacts=artifacts,
                stages=list(stages.values()),
                completed_at=now_iso(),
                source_sha256=source_sha256,
            )

        current_stage = "embeddings"
        _start(stages[current_stage])
        embeddings = generate_embeddings(chunks, output_dir)
        artifacts.append(artifact("embeddings", embeddings, "application/jsonl"))
        _complete(stages[current_stage], _embedding_model())

        if not pinecone_capability():
            _block_remaining(
                stages,
                "pinecone_storage",
                "PINECONE_API_KEY and PINECONE_INDEX are not configured",
            )
            return IngestionResult(
                run_id=job.run_id,
                document_id=job.document_id,
                status="manual_review",
                current_stage="pinecone_storage",
                artifacts=artifacts,
                stages=list(stages.values()),
                completed_at=now_iso(),
                source_sha256=source_sha256,
            )

        current_stage = "pinecone_storage"
        _start(stages[current_stage])
        receipt = upsert_pinecone(job, embeddings, output_dir)
        artifacts.append(artifact("pinecone_receipt", receipt, "application/json"))
        _complete(stages[current_stage], pinecone_namespace(job))

        current_stage = "hermes_memory"
        _start(stages[current_stage])
        memory_manifest = create_hermes_memory_manifest(
            job,
            source_sha256=source_sha256,
            chunks_path=chunks,
            embeddings_path=embeddings,
            pinecone_receipt_path=receipt,
            output_dir=output_dir,
        )
        artifacts.append(artifact("hermes_memory_manifest", memory_manifest, "application/json"))

        try:
            commit_result = commit_manifest_to_hermes(job, memory_manifest)
        except RuntimeError as exc:
            stages[current_stage].status = "blocked"
            stages[current_stage].completed_at = now_iso()
            stages[current_stage].detail = str(exc)
            return IngestionResult(
                run_id=job.run_id,
                document_id=job.document_id,
                status="manual_review",
                current_stage="hermes_memory",
                artifacts=artifacts,
                stages=list(stages.values()),
                completed_at=now_iso(),
                source_sha256=source_sha256,
            )

        _complete(
            stages[current_stage],
            f"Hermes memory commit confirmed (created={commit_result.get('created')})",
        )

        return IngestionResult(
            run_id=job.run_id,
            document_id=job.document_id,
            status="completed",
            current_stage="hermes_memory",
            artifacts=artifacts,
            stages=list(stages.values()),
            completed_at=now_iso(),
            source_sha256=source_sha256,
        )
    except Exception as exc:
        stage = stages[current_stage]
        stage.status = "failed"
        stage.completed_at = now_iso()
        stage.detail = str(exc)
        _block_remaining(stages, current_stage, f"Blocked after {current_stage} failure")
        return IngestionResult(
            run_id=job.run_id,
            document_id=job.document_id,
            status="failed",
            current_stage=current_stage,
            artifacts=artifacts,
            stages=list(stages.values()),
            completed_at=now_iso(),
            source_sha256=file_sha256(job.source_path) if job.source_path.exists() else "",
        )


if __name__ == "__main__":
    print("DKOS ingestion worker ready: real MarkItDown + semantic chunk execution enabled.")
