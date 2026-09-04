"""Standalone Godot worker for THE DOOR.

Run on a host that owns Godot projects and has the Godot editor binary installed:
    uvicorn backend.the_door.godot_worker:app --host 0.0.0.0 --port 8765

The worker never accepts arbitrary command arrays. It maps typed DoorJob kinds to
fixed Godot CLI operations and confines all project/build paths to an operator
configured workspace root.
"""
from __future__ import annotations

import asyncio
import os
import shutil
from pathlib import Path

from fastapi import Depends, FastAPI, Header, HTTPException
from pydantic import BaseModel

from backend.the_door.contracts import (
    DoorJob,
    DoorJobKind,
    DoorJobState,
    EngineRuntime,
    GameProject,
    VerificationResult,
)

app = FastAPI(title="D3VONN THE DOOR Godot Worker", version="0.1.0")

WORKSPACE_ROOT_RAW = os.getenv("THE_DOOR_GODOT_WORKSPACE_ROOT", "").strip()
WORKSPACE_ROOT = Path(WORKSPACE_ROOT_RAW).expanduser() if WORKSPACE_ROOT_RAW else None
GODOT_BIN = os.getenv("THE_DOOR_GODOT_BIN", "godot").strip() or "godot"
WORKER_TOKEN = os.getenv("THE_DOOR_GODOT_WORKER_TOKEN", "").strip()
COMMAND_TIMEOUT_SECONDS = max(1.0, min(float(os.getenv("THE_DOOR_GODOT_COMMAND_TIMEOUT_SECONDS", "120")), 1800.0))
MAX_LOG_CHARS = max(1000, min(int(os.getenv("THE_DOOR_GODOT_MAX_LOG_CHARS", "12000")), 100000))


class WorkerRequest(BaseModel):
    project: GameProject
    job: DoorJob


def _require_worker_token(authorization: str | None = Header(default=None)) -> None:
    if not WORKER_TOKEN:
        raise HTTPException(status_code=503, detail="Godot worker token is not configured")
    if authorization != f"Bearer {WORKER_TOKEN}":
        raise HTTPException(status_code=401, detail="Invalid Godot worker token")


def _resolved_binary() -> str | None:
    explicit = Path(GODOT_BIN).expanduser()
    if explicit.is_absolute():
        return str(explicit) if explicit.is_file() else None
    return shutil.which(GODOT_BIN)


def _workspace_ready() -> bool:
    return WORKSPACE_ROOT is not None and WORKSPACE_ROOT.is_dir()


def _workspace_root() -> Path:
    if not _workspace_ready() or WORKSPACE_ROOT is None:
        raise HTTPException(status_code=503, detail="Godot workspace root is not configured")
    return WORKSPACE_ROOT.resolve()


def _project_dir(job: DoorJob) -> Path:
    raw = str(job.input.get("project_path", "")).strip()
    if not raw:
        raise HTTPException(status_code=422, detail="job.input.project_path is required")

    root = _workspace_root()
    candidate = (root / raw).resolve()
    try:
        candidate.relative_to(root)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail="Project path escapes Godot workspace root") from exc
    if not candidate.is_dir() or not (candidate / "project.godot").is_file():
        raise HTTPException(status_code=404, detail="Godot project not found")
    return candidate


def _bounded_child_path(project_dir: Path, raw: str, label: str) -> Path:
    if not raw:
        raise HTTPException(status_code=422, detail=f"{label} is required")
    candidate = (project_dir / raw).resolve()
    try:
        candidate.relative_to(project_dir.resolve())
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=f"{label} escapes project directory") from exc
    return candidate


def _bounded_existing_output(project_dir: Path, raw: str, label: str) -> Path | None:
    if not raw:
        return None
    candidate = Path(raw).expanduser()
    if not candidate.is_absolute():
        candidate = (project_dir / candidate).resolve()
    else:
        candidate = candidate.resolve()
    try:
        candidate.relative_to(project_dir.resolve())
    except ValueError:
        return None
    return candidate


async def _run_godot(args: list[str]) -> tuple[int, str, str]:
    binary = _resolved_binary()
    if not binary:
        raise HTTPException(status_code=503, detail="Godot editor binary not found")

    process = await asyncio.create_subprocess_exec(
        binary,
        *args,
        stdout=asyncio.subprocess.PIPE,
        stderr=asyncio.subprocess.PIPE,
    )
    try:
        stdout, stderr = await asyncio.wait_for(process.communicate(), timeout=COMMAND_TIMEOUT_SECONDS)
    except asyncio.TimeoutError as exc:
        process.kill()
        await process.communicate()
        raise HTTPException(status_code=504, detail="Godot command timed out") from exc

    return (
        int(process.returncode or 0),
        stdout.decode("utf-8", errors="replace")[-MAX_LOG_CHARS:],
        stderr.decode("utf-8", errors="replace")[-MAX_LOG_CHARS:],
    )


def _validate_request(request: WorkerRequest) -> None:
    if request.project.engine != EngineRuntime.GODOT:
        raise HTTPException(status_code=409, detail="Godot worker only accepts Godot projects")
    if request.project.project_id != request.job.project_id:
        raise HTTPException(status_code=409, detail="Project/job IDs do not match")


@app.get("/health")
async def health() -> dict[str, object]:
    return {
        "status": "ok" if _resolved_binary() and _workspace_ready() and WORKER_TOKEN else "degraded",
        "worker": "the-door-godot",
        "godot_binary_found": bool(_resolved_binary()),
        "workspace_configured": _workspace_ready(),
        "auth_configured": bool(WORKER_TOKEN),
        "supported_jobs": [
            DoorJobKind.CREATE_OR_OPEN_PROJECT.value,
            DoorJobKind.RUN_PLAYTEST.value,
            DoorJobKind.PACKAGE_BUILD.value,
        ],
    }


@app.post("/v1/jobs/execute", response_model=DoorJob)
async def execute_job(request: WorkerRequest, _: None = Depends(_require_worker_token)) -> DoorJob:
    _validate_request(request)
    project_dir = _project_dir(request.job)
    job = request.job

    if job.kind == DoorJobKind.CREATE_OR_OPEN_PROJECT:
        return job.model_copy(
            update={
                "state": DoorJobState.SUCCEEDED,
                "output": {
                    **job.output,
                    "project_path": str(project_dir),
                    "project_file": str(project_dir / "project.godot"),
                },
            }
        )

    if job.kind == DoorJobKind.RUN_PLAYTEST:
        iterations = int(job.input.get("quit_after", 120))
        iterations = max(1, min(iterations, 36000))
        args = ["--headless", "--path", str(project_dir), "--quit-after", str(iterations)]
        scene = str(job.input.get("scene", "")).strip()
        if scene:
            scene_path = _bounded_child_path(project_dir, scene, "scene")
            if not scene_path.is_file():
                raise HTTPException(status_code=404, detail="Requested scene not found")
            args.extend(["--scene", str(scene_path)])
        code, stdout, stderr = await _run_godot(args)
        state = DoorJobState.SUCCEEDED if code == 0 else DoorJobState.FAILED
        return job.model_copy(
            update={
                "state": state,
                "output": {**job.output, "exit_code": code, "stdout": stdout, "stderr": stderr},
            }
        )

    if job.kind == DoorJobKind.PACKAGE_BUILD:
        preset = str(job.input.get("export_preset", "")).strip()
        output_raw = str(job.input.get("output_path", "")).strip()
        if not preset:
            raise HTTPException(status_code=422, detail="job.input.export_preset is required")
        output_path = _bounded_child_path(project_dir, output_raw, "output_path")
        output_path.parent.mkdir(parents=True, exist_ok=True)
        code, stdout, stderr = await _run_godot(
            ["--headless", "--path", str(project_dir), "--export-release", preset, str(output_path)]
        )
        state = DoorJobState.SUCCEEDED if code == 0 and output_path.exists() else DoorJobState.FAILED
        return job.model_copy(
            update={
                "state": state,
                "output": {
                    **job.output,
                    "exit_code": code,
                    "artifact_path": str(output_path),
                    "artifact_exists": output_path.exists(),
                    "stdout": stdout,
                    "stderr": stderr,
                },
            }
        )

    return job.model_copy(
        update={
            "state": DoorJobState.BLOCKED,
            "output": {
                **job.output,
                "reason": f"Godot worker does not implement {job.kind.value} yet.",
            },
        }
    )


@app.post("/v1/jobs/verify", response_model=VerificationResult)
async def verify_job(request: WorkerRequest, _: None = Depends(_require_worker_token)) -> VerificationResult:
    _validate_request(request)
    job = request.job
    project_dir = _project_dir(job)

    checks: list[str] = []
    failures: list[str] = []
    observations: dict[str, object] = {"job_state": job.state.value, "job_kind": job.kind.value}

    if job.state not in {DoorJobState.SUCCEEDED, DoorJobState.VERIFIED}:
        failures.append("Job has not succeeded")

    if job.kind == DoorJobKind.PACKAGE_BUILD:
        artifact = _bounded_existing_output(project_dir, str(job.output.get("artifact_path", "")).strip(), "artifact_path")
        artifact_exists = bool(artifact and artifact.is_file())
        observations["artifact_exists"] = artifact_exists
        if artifact_exists:
            checks.append("packaged artifact exists within project workspace")
        else:
            failures.append("packaged artifact is missing or outside project workspace")
    elif job.kind == DoorJobKind.RUN_PLAYTEST:
        if int(job.output.get("exit_code", -1)) == 0:
            checks.append("headless playtest exited successfully")
        else:
            failures.append("headless playtest returned a non-zero exit code")
    elif job.kind == DoorJobKind.CREATE_OR_OPEN_PROJECT:
        if (project_dir / "project.godot").is_file():
            checks.append("project.godot exists within configured workspace")
        else:
            failures.append("project.godot could not be verified")
    else:
        failures.append(f"Verification for {job.kind.value} is not implemented")

    return VerificationResult(
        passed=not failures,
        checks=checks,
        failures=failures,
        observations=observations,
    )
