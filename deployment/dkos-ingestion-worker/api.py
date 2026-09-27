"""FastAPI scaffold for DKOS ingestion endpoints.

Deploy this service on Railway or AWS when the DKOS ingestion worker is activated.
It matches the frontend contract used by src/lib/dkos/ingestionClient.ts.
"""

from __future__ import annotations

from datetime import datetime, timezone
import hmac
import os
from urllib.parse import urlparse
from pathlib import Path
from typing import Literal
from uuid import uuid4

from fastapi import FastAPI, File, Form, Header, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field
import httpx

from worker import IngestionJob, embedding_capability, pinecone_capability, run_ingestion

Status = Literal["pending", "running", "completed", "failed", "manual_review"]

app = FastAPI(title="D3VONN DKOS Ingestion API", version="0.2.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "https://d3vonn.io",
        "https://www.d3vonn.io",
        "https://devonn.ai",
        "https://www.devonn.ai",
        "http://localhost:8080",
        "http://localhost:5173",
    ],
    allow_credentials=True,
    allow_methods=["GET", "POST", "OPTIONS"],
    allow_headers=["*"],
)

RUNS: dict[str, dict] = {}
ARTIFACTS: dict[str, list[dict]] = {}
UPLOAD_ROOT = Path("/tmp/dkos-uploads")


class StartIngestionResponse(BaseModel):
    run_id: str
    document_id: str
    status: Status
    current_stage: str


class IngestionRunResponse(BaseModel):
    runId: str
    document: dict
    status: Status
    currentStage: str
    stages: list[dict]
    artifacts: list[dict]
    createdAt: str
    updatedAt: str


class ArtifactsResponse(BaseModel):
    run_id: str
    artifacts: list[dict]


class SourceIngestionRequest(BaseModel):
    source_uri: str = Field(min_length=8, max_length=4000)
    tenant_id: str = Field(min_length=1, max_length=240)
    uploaded_by: str = Field(min_length=1, max_length=240)
    classification: str = Field(default="internal", max_length=40)
    profile_id: str | None = None
    source_id: str | None = None
    source_type: str | None = Field(default=None, max_length=40)
    title: str | None = Field(default=None, max_length=240)


def _require_service_key(provided: str | None) -> None:
    configured = os.getenv("DKOS_SERVICE_KEY", "").strip()
    if not configured:
        raise HTTPException(status_code=503, detail="DKOS service authentication is not configured")
    if not provided or not hmac.compare_digest(configured, provided):
        raise HTTPException(status_code=401, detail="Invalid DKOS service credential")


def _allowed_source_host(uri: str) -> str:
    parsed = urlparse(uri)
    if parsed.scheme != "https" or not parsed.hostname:
        raise HTTPException(status_code=422, detail="source_uri must use HTTPS")
    allowlist = {
        host.strip().lower()
        for host in os.getenv("DKOS_SOURCE_HOST_ALLOWLIST", "").split(",")
        if host.strip()
    }
    if not allowlist:
        raise HTTPException(status_code=503, detail="DKOS source host allowlist is not configured")
    hostname = parsed.hostname.lower()
    if hostname not in allowlist:
        raise HTTPException(status_code=403, detail="Source host is not allowlisted")
    return hostname


def _safe_filename(uri: str, title: str | None, source_type: str | None) -> str:
    parsed = urlparse(uri)
    candidate = Path(parsed.path).name
    if candidate and "." in candidate:
        return candidate[:180]
    stem = "".join(ch for ch in (title or "client-ai-source") if ch.isalnum() or ch in {"-", "_"})[:120] or "client-ai-source"
    suffix = {
        "website": ".html",
        "note": ".txt",
        "conversation": ".txt",
        "voice": ".audio",
        "video": ".video",
        "image": ".img",
    }.get((source_type or "").lower(), ".bin")
    return stem + suffix


async def _download_allowlisted_source(uri: str, target: Path) -> None:
    _allowed_source_host(uri)
    max_bytes = int(os.getenv("DKOS_MAX_UPLOAD_BYTES", str(100 * 1024 * 1024)))
    try:
        async with httpx.AsyncClient(timeout=60.0, follow_redirects=False) as client:
            response = await client.get(uri)
    except httpx.RequestError as exc:
        raise HTTPException(status_code=502, detail="Unable to fetch Client AI source") from exc
    if response.status_code != 200:
        raise HTTPException(status_code=502, detail=f"Source fetch returned HTTP {response.status_code}")
    content_length = response.headers.get("content-length")
    if content_length and int(content_length) > max_bytes:
        raise HTTPException(status_code=413, detail="Source exceeds DKOS upload limit")
    if len(response.content) > max_bytes:
        raise HTTPException(status_code=413, detail="Source exceeds DKOS upload limit")
    if not response.content:
        raise HTTPException(status_code=422, detail="Source returned empty content")
    target.write_bytes(response.content)


def now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


@app.get("/health")
def health() -> dict:
    return {
        "status": "ok",
        "service": "dkos-ingestion",
        "version": "0.2.0",
        "capabilities": {
            "markitdown": True,
            "docling_enabled": __import__("os").getenv("DKOS_ENABLE_DOCLING", "false").lower() in {"1", "true", "yes"},
            "semantic_chunking": True,
            "embeddings": embedding_capability(),
            "pinecone_storage": pinecone_capability(),
            "hermes_memory": pinecone_capability(),
        },
    }


@app.post("/api/dkos/ingestion/sources", response_model=StartIngestionResponse)
async def start_source_ingestion(
    payload: SourceIngestionRequest,
    x_dkos_service_key: str | None = Header(default=None, alias="X-DKOS-Service-Key"),
) -> StartIngestionResponse:
    _require_service_key(x_dkos_service_key)
    _allowed_source_host(payload.source_uri)

    run_id = str(uuid4())
    document_id = str(uuid4())
    created_at = now_iso()
    run_dir = UPLOAD_ROOT / run_id
    run_dir.mkdir(parents=True, exist_ok=True)
    filename = _safe_filename(payload.source_uri, payload.title, payload.source_type)
    source_path = run_dir / filename
    await _download_allowlisted_source(payload.source_uri, source_path)

    RUNS[run_id] = {
        "runId": run_id,
        "document": {
            "documentId": document_id,
            "sourceFilename": filename,
            "sourceType": payload.source_type or (Path(filename).suffix.lower().lstrip(".") or "unknown"),
            "tenantId": payload.tenant_id,
            "uploadedBy": payload.uploaded_by,
            "classification": payload.classification,
            "profileId": payload.profile_id,
            "sourceId": payload.source_id,
            "sourceUriHost": urlparse(payload.source_uri).hostname,
            "agentAccess": [],
        },
        "status": "running",
        "currentStage": "security_scan",
        "stages": [
            {"stage": "upload", "status": "completed", "completedAt": created_at},
            {"stage": "security_scan", "status": "running", "startedAt": created_at},
        ],
        "artifacts": [],
        "createdAt": created_at,
        "updatedAt": created_at,
    }

    result = run_ingestion(
        IngestionJob(
            source_path=source_path,
            tenant_id=payload.tenant_id,
            uploaded_by=payload.uploaded_by,
            classification=payload.classification,
            profile_id=payload.profile_id,
            source_id=payload.source_id,
            run_id=run_id,
            document_id=document_id,
        )
    )
    artifacts = [artifact.__dict__ for artifact in result.artifacts]
    stages = [
        {
            "stage": stage.stage,
            "status": stage.status,
            "startedAt": stage.started_at,
            "completedAt": stage.completed_at,
            "detail": stage.detail,
        }
        for stage in result.stages
    ]
    ARTIFACTS[run_id] = artifacts
    RUNS[run_id].update(
        {
            "status": result.status,
            "currentStage": result.current_stage,
            "stages": stages,
            "artifacts": artifacts,
            "sourceSha256": result.source_sha256,
            "updatedAt": now_iso(),
        }
    )
    return StartIngestionResponse(
        run_id=run_id,
        document_id=document_id,
        status=result.status,
        current_stage=result.current_stage,
    )


@app.post("/api/dkos/ingestion/runs", response_model=StartIngestionResponse)
async def start_ingestion(
    file: UploadFile = File(...),
    tenant_id: str = Form(...),
    uploaded_by: str = Form(...),
    classification: str = Form("internal"),
    profile_id: str | None = Form(None),
    source_id: str | None = Form(None),
    agent_access: str | None = Form(None),
) -> StartIngestionResponse:
    if not file.filename:
        raise HTTPException(status_code=400, detail="Missing filename")

    run_id = str(uuid4())
    document_id = str(uuid4())
    created_at = now_iso()
    run_dir = UPLOAD_ROOT / run_id
    run_dir.mkdir(parents=True, exist_ok=True)
    source_path = run_dir / file.filename

    content = await file.read()
    if not content:
        raise HTTPException(status_code=400, detail="Uploaded file is empty")

    source_path.write_bytes(content)

    RUNS[run_id] = {
        "runId": run_id,
        "document": {
            "documentId": document_id,
            "sourceFilename": file.filename,
            "sourceType": Path(file.filename).suffix.lower().lstrip(".") or "unknown",
            "tenantId": tenant_id,
            "uploadedBy": uploaded_by,
            "classification": classification,
            "profileId": profile_id,
            "sourceId": source_id,
            "agentAccess": agent_access.split(",") if agent_access else [],
        },
        "status": "running",
        "currentStage": "security_scan",
        "stages": [
            {"stage": "upload", "status": "completed", "completedAt": created_at},
            {"stage": "security_scan", "status": "running", "startedAt": created_at},
        ],
        "artifacts": [],
        "createdAt": created_at,
        "updatedAt": created_at,
    }

    try:
        result = run_ingestion(
            IngestionJob(
                source_path=source_path,
                tenant_id=tenant_id,
                uploaded_by=uploaded_by,
                classification=classification,
                profile_id=profile_id,
                source_id=source_id,
                run_id=run_id,
                document_id=document_id,
            )
        )
        artifacts = [artifact.__dict__ for artifact in result.artifacts]
        stages = [
            {
                "stage": stage.stage,
                "status": stage.status,
                "startedAt": stage.started_at,
                "completedAt": stage.completed_at,
                "detail": stage.detail,
            }
            for stage in result.stages
        ]
        ARTIFACTS[run_id] = artifacts
        RUNS[run_id].update(
            {
                "status": result.status,
                "currentStage": result.current_stage,
                "stages": stages,
                "artifacts": artifacts,
                "sourceSha256": result.source_sha256,
                "updatedAt": now_iso(),
            }
        )
    except Exception as exc:
        RUNS[run_id].update(
            {
                "status": "failed",
                "currentStage": RUNS[run_id].get("currentStage", "security_scan"),
                "updatedAt": now_iso(),
                "error": str(exc),
            }
        )

    return StartIngestionResponse(
        run_id=run_id,
        document_id=document_id,
        status=RUNS[run_id]["status"],
        current_stage=RUNS[run_id]["currentStage"],
    )


@app.get("/api/dkos/ingestion/runs/{run_id}", response_model=IngestionRunResponse)
def get_run(run_id: str) -> dict:
    run = RUNS.get(run_id)
    if not run:
        raise HTTPException(status_code=404, detail="Ingestion run not found")
    return run


@app.get("/api/dkos/ingestion/runs/{run_id}/artifacts", response_model=ArtifactsResponse)
def get_artifacts(run_id: str) -> ArtifactsResponse:
    if run_id not in RUNS:
        raise HTTPException(status_code=404, detail="Ingestion run not found")
    return ArtifactsResponse(run_id=run_id, artifacts=ARTIFACTS.get(run_id, []))
