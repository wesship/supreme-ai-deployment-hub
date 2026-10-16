"""Authenticated, opt-in stem studio pilot. No model runs in the API process."""
import json
import os
from pathlib import Path
import shutil
import time
from uuid import UUID, uuid4

from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile
from fastapi.responses import FileResponse
from backend.app.middleware.auth import get_current_user_id
from backend.music import store
from backend.music.operations import Operation, available_tools, validate_options

router = APIRouter(prefix="/api/music/stems", tags=["music-stems"])
MAX_BYTES = 50 * 1024 * 1024


def enabled():
    if os.getenv("MUSIC_STEMS_ENABLED", "").lower() != "true" or not os.getenv("MUSIC_STEM_DATA_DIR"):
        raise HTTPException(503, "Stem Studio is awaiting worker configuration")


def owned(job_id: UUID, owner: str):
    job = store.get_job(str(job_id), owner)
    if not job:
        raise HTTPException(404, "Stem job not found")
    return job


def public(job):
    artifacts = [{"name": name, "filename": Path(path).name} for name, path in job["outputs"].items()]
    return {key: job[key] for key in ("id", "mode", "status", "error")} | {
        "stems": [name for name, path in job["outputs"].items() if Path(path).suffix == '.wav'],
        "artifacts": artifacts,
    }


@router.get("/capabilities")
def capabilities():
    ready = os.getenv("MUSIC_STEMS_ENABLED", "").lower() == "true" and bool(os.getenv("MUSIC_STEM_DATA_DIR"))
    return {"enabled": ready, "modes": ["vocals", "four_stems"], "max_bytes": MAX_BYTES, "pilot": True, "tools": available_tools() if ready else []}


@router.post("/jobs", status_code=202, dependencies=[Depends(enabled)])
def submit(file: UploadFile = File(...), mode: Operation = Form(...), settings: str = Form("{}"),
           rights_confirmed: bool = Form(False), owner: str = Depends(get_current_user_id)):
    try:
        if not rights_confirmed:
            raise HTTPException(422, "Confirm permission to process this recording")
        if mode not in ('vocals', 'four_stems') and mode not in available_tools():
            raise HTTPException(503, "This audio tool is awaiting worker qualification")
        try:
            options = validate_options(mode, json.loads(settings))
        except (ValueError, TypeError):
            raise HTTPException(422, "Invalid settings for the selected operation") from None
        suffix = Path(file.filename or "").suffix.lower()
        if suffix not in {".wav", ".mp3", ".flac", ".m4a", ".ogg"}:
            raise HTTPException(415, "Use WAV, MP3, FLAC, M4A, or OGG audio")
        # Serialize reservation and quota check across API processes. Uploads
        # count against quota before writing; a partial upload cannot be claimed.
        job_id = str(uuid4())
        now = time.time()
        with store.connect() as db:
            db.execute("BEGIN IMMEDIATE")
            count = db.execute("SELECT COUNT(*) FROM jobs WHERE owner=? AND created>?", (owner, now - 86400)).fetchone()[0]
            total = db.execute("SELECT COUNT(*) FROM jobs").fetchone()[0]
            if count >= 10 or total >= 100:
                raise HTTPException(429, "Pilot processing capacity reached")
            db.execute("INSERT INTO jobs(id,owner,mode,status,created,updated,options) VALUES(?,?,?,'uploading',?,?,?)", (job_id, owner, mode, now, now, json.dumps(options)))
        directory = store.root() / job_id
        try:
            directory.mkdir(mode=0o700)
            size = 0
            with (directory / "source").open("wb") as output:
                while chunk := file.file.read(1024 * 1024):
                    size += len(chunk)
                    if size > MAX_BYTES:
                        raise HTTPException(413, "Maximum upload is 50 MiB")
                    output.write(chunk)
            if not size:
                raise HTTPException(422, "The audio file is empty")
            with store.connect() as db:
                db.execute("UPDATE jobs SET status='queued', updated=? WHERE id=?", (time.time(), job_id))
        except BaseException:
            shutil.rmtree(directory, ignore_errors=True)
            with store.connect() as db:
                db.execute("DELETE FROM jobs WHERE id=?", (job_id,))
            raise
        return public(store.get_job(job_id, owner))
    finally:
        file.file.close()


@router.get("/jobs/{job_id}", dependencies=[Depends(enabled)])
def status(job_id: UUID, owner: str = Depends(get_current_user_id)):
    return public(owned(job_id, owner))


@router.get("/jobs/{job_id}/audio/{stem}", dependencies=[Depends(enabled)])
def download(job_id: UUID, stem: str, preview: bool = False, owner: str = Depends(get_current_user_id)):
    job = owned(job_id, owner)
    if job["status"] != "completed" or stem not in job["outputs"] or Path(job['outputs'][stem]).suffix != '.wav':
        raise HTTPException(404, "Stem not available")
    directory = (store.root() / str(job_id)).resolve()
    path = (directory / job["outputs"][stem]).resolve()
    if preview:
        path = path.with_suffix(".preview.wav")
    if not path.is_relative_to(directory) or not path.is_file():
        raise HTTPException(404, "Stem not available")
    return FileResponse(path, media_type="audio/wav", filename=f"{stem}.wav", headers={"Cache-Control": "no-store"})


@router.get("/jobs/{job_id}/artifacts/{name}", dependencies=[Depends(enabled)])
def artifact(job_id: UUID, name: str, owner: str = Depends(get_current_user_id)):
    job = owned(job_id, owner)
    if job['status'] != 'completed' or name not in job['outputs']:
        raise HTTPException(404, 'Artifact not available')
    directory = (store.root() / str(job_id)).resolve()
    path = (directory / job['outputs'][name]).resolve()
    types = {'.wav': 'audio/wav', '.mid': 'audio/midi', '.json': 'application/json', '.txt': 'text/plain', '.srt': 'application/x-subrip'}
    if not path.is_relative_to(directory) or not path.is_file() or path.suffix not in types:
        raise HTTPException(404, 'Artifact not available')
    return FileResponse(path, media_type=types[path.suffix], filename=path.name, headers={'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff'})
