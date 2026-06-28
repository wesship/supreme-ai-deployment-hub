"""FastAPI scaffold for DKOS ingestion endpoints.

Deploy this service on Railway or AWS when the DKOS ingestion worker is activated.
It matches the frontend contract used by src/lib/dkos/ingestionClient.ts.
"""

from __future__ import annotations

from datetime import datetime, timezone
from pathlib import Path
from typing import Literal
from uuid import uuid4

from fastapi import FastAPI, File, Form, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

from worker import IngestionJob, run_ingestion

Status = Literal["pending", "running", "completed", "failed", "manual_review"]

app = FastAPI(title="D3VONN DKOS Ingestion API", version="0.1.0")

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


def now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


@app.get("/health")
def health() -> dict:
    return {"status": "ok", "service": "dkos-ingestion", "version": "0.1.0"}


@app.post("/api/dkos/ingestion/runs", response_model=StartIngestionResponse)
async def start_ingestion(
    file: UploadFile = File(...),
    tenant_id: str = Form(...),
    uploaded_by: str = Form(...),
    classification: str = Form("internal"),
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
                run_id=run_id,
                document_id=document_id,
            )
        )
        artifacts = [artifact.__dict__ for artifact in result.artifacts]
        ARTIFACTS[run_id] = artifacts
        RUNS[run_id].update(
            {
                "status": "completed",
                "currentStage": "dkos_retrieval",
                "artifacts": artifacts,
                "updatedAt": now_iso(),
            }
        )
    except Exception as exc:
        RUNS[run_id].update(
            {
                "status": "failed",
                "currentStage": "security_scan",
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
