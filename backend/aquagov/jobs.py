"""AquaGov local-first reconstruction job API.

This module intentionally keeps job state in memory for the first executable
vertical slice. Replace the store with Redis/Postgres when durable workers are
connected; the HTTP contract remains unchanged.
"""

from __future__ import annotations

from datetime import datetime, timezone
from enum import Enum
from threading import Lock
from typing import Any
from uuid import uuid4

from fastapi import APIRouter, HTTPException, status
from pydantic import BaseModel, Field

router = APIRouter(prefix="/api/aquagov", tags=["aquagov"])


class JobStatus(str, Enum):
    queued = "queued"
    running = "running"
    review = "review"
    complete = "complete"
    failed = "failed"
    cancelled = "cancelled"


class EvidenceState(str, Enum):
    observed = "observed"
    reconstructed = "reconstructed"
    inferred = "inferred"
    verified = "verified"


class JobCreate(BaseModel):
    site_id: str = Field(min_length=1, max_length=128)
    asset_id: str = Field(min_length=1, max_length=128)
    input_uri: str = Field(min_length=1, max_length=2048)
    input_kind: str = Field(default="panorama", min_length=1, max_length=64)
    requested_outputs: list[str] = Field(default_factory=lambda: ["gaussian-splat"], min_length=1, max_length=16)
    evidence_state: EvidenceState = EvidenceState.reconstructed


class Job(BaseModel):
    job_id: str
    site_id: str
    asset_id: str
    input_uri: str
    input_kind: str
    requested_outputs: list[str]
    status: JobStatus
    stage: str
    progress: float
    evidence_state: EvidenceState
    created_at: str
    updated_at: str
    outputs: dict[str, str] = Field(default_factory=dict)


class JobStore:
    def __init__(self) -> None:
        self._jobs: dict[str, Job] = {}
        self._lock = Lock()

    def create(self, request: JobCreate) -> Job:
        now = datetime.now(timezone.utc).isoformat()
        job = Job(
            job_id=str(uuid4()),
            site_id=request.site_id,
            asset_id=request.asset_id,
            input_uri=request.input_uri,
            input_kind=request.input_kind,
            requested_outputs=request.requested_outputs,
            status=JobStatus.queued,
            stage="preflight",
            progress=0.0,
            evidence_state=request.evidence_state,
            created_at=now,
            updated_at=now,
        )
        with self._lock:
            self._jobs[job.job_id] = job
        return job

    def get(self, job_id: str) -> Job | None:
        with self._lock:
            return self._jobs.get(job_id)

    def update(self, job_id: str, **changes: Any) -> Job:
        with self._lock:
            job = self._jobs.get(job_id)
            if job is None:
                raise KeyError(job_id)
            changes["updated_at"] = datetime.now(timezone.utc).isoformat()
            updated = job.model_copy(update=changes)
            self._jobs[job_id] = updated
            return updated


store = JobStore()


@router.post("/jobs", response_model=Job, status_code=status.HTTP_202_ACCEPTED)
async def create_job(request: JobCreate) -> Job:
    """Queue a structured reconstruction request; never executes shell input."""
    return store.create(request)


@router.get("/jobs/{job_id}", response_model=Job)
async def get_job(job_id: str) -> Job:
    job = store.get(job_id)
    if job is None:
        raise HTTPException(status_code=404, detail="AquaGov job not found")
    return job


@router.post("/jobs/{job_id}/cancel", response_model=Job)
async def cancel_job(job_id: str) -> Job:
    job = store.get(job_id)
    if job is None:
        raise HTTPException(status_code=404, detail="AquaGov job not found")
    if job.status not in {JobStatus.queued, JobStatus.running}:
        raise HTTPException(status_code=409, detail=f"Cannot cancel job in {job.status} state")
    return store.update(job_id, status=JobStatus.cancelled, stage="cancelled")


@router.post("/jobs/{job_id}/simulate", response_model=Job)
async def simulate_job(job_id: str) -> Job:
    """Advance the test worker one deterministic stage; no GPU work occurs."""
    job = store.get(job_id)
    if job is None:
        raise HTTPException(status_code=404, detail="AquaGov job not found")
    if job.status in {JobStatus.complete, JobStatus.failed, JobStatus.cancelled}:
        raise HTTPException(status_code=409, detail=f"Job is already {job.status}")

    stages = ["preflight", "matrix3d", "wan21", "reprojection", "colmap", "splat-training", "qa", "publish"]
    try:
        index = stages.index(job.stage)
    except ValueError:
        index = 0

    next_index = min(index + 1, len(stages) - 1)
    next_stage = stages[next_index]
    progress = round(next_index / (len(stages) - 1), 2)
    if next_stage == "qa":
        return store.update(job_id, status=JobStatus.review, stage=next_stage, progress=progress)
    if next_stage == "publish":
        return store.update(
            job_id,
            status=JobStatus.complete,
            stage=next_stage,
            progress=1.0,
            outputs={"splat": f"local://assets/{job.site_id}/{job.asset_id}.splat"},
        )
    return store.update(job_id, status=JobStatus.running, stage=next_stage, progress=progress)


@router.get("/health")
async def aquagov_health() -> dict[str, str]:
    return {"status": "ok", "service": "aquagov-job-api", "worker": "mock"}
