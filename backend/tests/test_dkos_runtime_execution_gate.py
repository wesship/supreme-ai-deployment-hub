from __future__ import annotations

import importlib.util
import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
WORKER_PATH = ROOT / "deployment" / "dkos-ingestion-worker" / "worker.py"


def _load_worker():
    spec = importlib.util.spec_from_file_location("dkos_runtime_worker", WORKER_PATH)
    assert spec and spec.loader
    module = importlib.util.module_from_spec(spec)
    sys.modules[spec.name] = module
    spec.loader.exec_module(module)
    return module


def test_worker_has_real_markitdown_and_no_placeholder_output():
    source = WORKER_PATH.read_text()
    assert "from markitdown import MarkItDown" in source
    assert "Placeholder Markdown output" not in source
    assert "Wire Docling parser here" not in source
    assert "semantic_chunks(" in source
    assert 'status="manual_review"' in source
    assert '"embeddings"' in source
    assert '"hermes_memory"' in source


def test_security_scan_rejects_executables(tmp_path):
    worker = _load_worker()
    source = tmp_path / "payload.exe"
    source.write_bytes(b"MZ-not-really-an-executable")
    job = worker.IngestionJob(source_path=source, tenant_id="tenant", uploaded_by="user")

    try:
        worker.security_scan(job)
    except ValueError as exc:
        assert "Executable file type" in str(exc)
    else:
        raise AssertionError("Executable source should be rejected")


def test_semantic_chunking_is_deterministic(tmp_path):
    worker = _load_worker()
    markdown = tmp_path / "document.md"
    markdown.write_text(
        "# Heading\n\n" + ("alpha beta gamma " * 60) + "\n\n" + ("delta epsilon " * 60),
        encoding="utf-8",
    )
    one = tmp_path / "one"
    two = tmp_path / "two"
    one.mkdir()
    two.mkdir()
    first = worker.semantic_chunks(markdown, one, max_tokens=50)
    second = worker.semantic_chunks(markdown, two, max_tokens=50)

    first_rows = [json.loads(line) for line in first.read_text().splitlines()]
    second_rows = [json.loads(line) for line in second.read_text().splitlines()]
    assert first_rows
    assert first_rows == second_rows
    assert all(row["sha256"] for row in first_rows)
    assert all(row["token_count"] > 0 for row in first_rows)


def test_docling_is_optional_and_disabled_by_default(tmp_path, monkeypatch):
    worker = _load_worker()
    source = tmp_path / "source.txt"
    source.write_text("hello", encoding="utf-8")
    job = worker.IngestionJob(source_path=source, tenant_id="tenant", uploaded_by="user")
    monkeypatch.delenv("DKOS_ENABLE_DOCLING", raising=False)

    assert worker.run_docling(job, tmp_path) is None


def test_downstream_stages_remain_blocked_without_adapters(tmp_path, monkeypatch):
    worker = _load_worker()
    source = tmp_path / "source.txt"
    source.write_text("one paragraph\n\ntwo paragraph", encoding="utf-8")
    job = worker.IngestionJob(source_path=source, tenant_id="tenant", uploaded_by="user")

    def fake_markitdown(_job, output_dir):
        path = output_dir / "document.raw.md"
        path.write_text("# Source\n\none paragraph\n\ntwo paragraph\n", encoding="utf-8")
        return path

    monkeypatch.setattr(worker, "run_markitdown", fake_markitdown)
    result = worker.run_ingestion(job, output_root=tmp_path / "runs")

    assert result.status == "manual_review"
    assert result.current_stage == "embeddings"
    states = {stage.stage: stage.status for stage in result.stages}
    assert states["markitdown"] == "completed"
    assert states["semantic_chunking"] == "completed"
    assert states["embeddings"] == "blocked"
    assert states["pinecone_storage"] == "blocked"
    assert states["hermes_memory"] == "blocked"
    kinds = {item.kind for item in result.artifacts}
    assert {"raw_markdown", "markdown", "source_metadata", "chunks"} <= kinds
