"""DKOS ingestion worker scaffold.

This file defines the server-side pipeline shape for Docling -> MarkItDown -> DKOS.
It is intentionally lightweight and safe to commit. Production integrations should
wire queue intake, object storage, Supabase, Pinecone, and Hermes memory clients.
"""

from __future__ import annotations

from dataclasses import dataclass, field
from datetime import datetime, timezone
from pathlib import Path
from typing import Literal
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


@dataclass
class Artifact:
    kind: str
    path: str
    content_type: str


@dataclass
class IngestionJob:
    source_path: Path
    tenant_id: str
    uploaded_by: str
    classification: str = "internal"
    run_id: str = field(default_factory=lambda: str(uuid4()))
    document_id: str = field(default_factory=lambda: str(uuid4()))


@dataclass
class IngestionResult:
    run_id: str
    document_id: str
    status: Status
    artifacts: list[Artifact]
    completed_at: str


def now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def security_scan(job: IngestionJob) -> None:
    if not job.source_path.exists():
        raise FileNotFoundError(f"Source file not found: {job.source_path}")
    if job.source_path.stat().st_size <= 0:
        raise ValueError("Source file is empty")


def file_classification(job: IngestionJob) -> str:
    return job.source_path.suffix.lower().lstrip(".") or "unknown"


def run_docling(job: IngestionJob, output_dir: Path) -> Path:
    output_path = output_dir / "docling-output.json"
    output_path.write_text(
        '{"status":"placeholder","message":"Wire Docling parser here"}\n',
        encoding="utf-8",
    )
    return output_path


def run_markitdown(job: IngestionJob, output_dir: Path) -> Path:
    output_path = output_dir / "document.md"
    output_path.write_text(
        f"# {job.source_path.name}\n\nPlaceholder Markdown output. Wire MarkItDown here.\n",
        encoding="utf-8",
    )
    return output_path


def create_metadata(job: IngestionJob, source_type: str, output_dir: Path) -> Path:
    output_path = output_dir / "source_metadata.json"
    output_path.write_text(
        "{\n"
        f'  "run_id": "{job.run_id}",\n'
        f'  "document_id": "{job.document_id}",\n'
        f'  "source_filename": "{job.source_path.name}",\n'
        f'  "source_type": "{source_type}",\n'
        f'  "tenant_id": "{job.tenant_id}",\n'
        f'  "uploaded_by": "{job.uploaded_by}",\n'
        f'  "classification": "{job.classification}",\n'
        f'  "created_at": "{now_iso()}"\n'
        "}\n",
        encoding="utf-8",
    )
    return output_path


def run_ingestion(job: IngestionJob, output_root: Path = Path("/tmp/dkos-ingestion")) -> IngestionResult:
    output_dir = output_root / job.run_id
    output_dir.mkdir(parents=True, exist_ok=True)

    security_scan(job)
    source_type = file_classification(job)

    metadata = create_metadata(job, source_type, output_dir)
    docling_output = run_docling(job, output_dir)
    markdown = run_markitdown(job, output_dir)

    artifacts = [
        Artifact("source_metadata", str(metadata), "application/json"),
        Artifact("docling_output", str(docling_output), "application/json"),
        Artifact("markdown", str(markdown), "text/markdown"),
    ]

    return IngestionResult(
        run_id=job.run_id,
        document_id=job.document_id,
        status="completed",
        artifacts=artifacts,
        completed_at=now_iso(),
    )


if __name__ == "__main__":
    print("DKOS ingestion worker scaffold ready. Wire queue intake to run_ingestion().")
