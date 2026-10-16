"""Gate 10: durable, owner-scoped stem job ledger. No public API or worker dispatch."""
from __future__ import annotations
import json
import re
import sqlite3
import uuid
from datetime import datetime, timezone
from pathlib import Path

IDENTITY = re.compile(r"^[A-Za-z0-9_-]{1,128}$")
SHA256 = re.compile(r"^[a-fA-F0-9]{64}$")
STATES = {"queued", "running", "succeeded", "failed", "cancelled"}
ALLOWED = {
    "queued": {"running", "cancelled", "failed"},
    "running": {"succeeded", "failed", "cancelled"},
    "succeeded": set(), "failed": set(), "cancelled": set(),
}

class JobDenied(ValueError):
    pass

class StemJobLedger:
    """SQLite prototype; production must use tenant-scoped database + durable queue."""
    def __init__(self, database: Path):
        self.database = database

    def connect(self):
        db = sqlite3.connect(self.database, timeout=10)
        db.row_factory = sqlite3.Row
        db.execute("PRAGMA busy_timeout=10000")
        return db

    def setup(self):
        with self.connect() as db:
            db.execute("""CREATE TABLE IF NOT EXISTS stem_jobs (
              id TEXT PRIMARY KEY, owner TEXT NOT NULL, idem TEXT NOT NULL,
              source_sha TEXT NOT NULL, model TEXT NOT NULL,
              status TEXT NOT NULL, progress INTEGER NOT NULL DEFAULT 0,
              artifacts TEXT NOT NULL DEFAULT '[]', created_at TEXT NOT NULL,
              UNIQUE(owner, idem))""")
            db.execute("CREATE INDEX IF NOT EXISTS stem_jobs_owner_idx ON stem_jobs(owner, created_at)")

    @staticmethod
    def validate(owner, idem, source_sha, model):
        if not IDENTITY.fullmatch(owner) or not IDENTITY.fullmatch(idem):
            raise JobDenied("INVALID_JOB_IDENTITY")
        if not SHA256.fullmatch(source_sha) or model not in ("demucs", "audio-separator"):
            raise JobDenied("INVALID_JOB_REQUEST")

    @staticmethod
    def as_dict(row):
        data = dict(row)
        data["artifacts"] = json.loads(data["artifacts"])
        return data

    def submit(self, *, owner: str, idem: str, source_sha: str, model: str, qualified: bool = False):
        self.validate(owner, idem, source_sha, model)
        if not qualified:
            raise JobDenied("SEPARATION_PROVIDER_NOT_QUALIFIED")
        with self.connect() as db:
            db.execute("BEGIN IMMEDIATE")
            old = db.execute("SELECT * FROM stem_jobs WHERE owner=? AND idem=?", (owner, idem)).fetchone()
            if old:
                if old["source_sha"] != source_sha or old["model"] != model:
                    raise JobDenied("IDEMPOTENCY_CONFLICT")
                return self.as_dict(old)
            job_id = uuid.uuid4().hex
            db.execute("INSERT INTO stem_jobs (id,owner,idem,source_sha,model,status,created_at) VALUES (?,?,?,?,?,?,?)",
                       (job_id, owner, idem, source_sha, model, "queued",
                        datetime.now(timezone.utc).isoformat()))
            row = db.execute("SELECT * FROM stem_jobs WHERE id=?", (job_id,)).fetchone()
            return self.as_dict(row)

    def get(self, *, owner: str, job_id: str):
        if not IDENTITY.fullmatch(owner) or not IDENTITY.fullmatch(job_id):
            raise JobDenied("INVALID_JOB_IDENTITY")
        with self.connect() as db:
            row = db.execute("SELECT * FROM stem_jobs WHERE owner=? AND id=?", (owner, job_id)).fetchone()
        if not row:
            raise JobDenied("JOB_NOT_FOUND")
        return self.as_dict(row)

    def transition(self, *, owner: str, job_id: str, new_status: str, progress: int, worker_authorized: bool = False):
        if new_status not in STATES or type(progress) is not int or not 0 <= progress <= 100:
            raise JobDenied("INVALID_JOB_TRANSITION")
        if not worker_authorized and new_status != "cancelled":
            raise JobDenied("WORKER_AUTHORIZATION_REQUIRED")
        with self.connect() as db:
            db.execute("BEGIN IMMEDIATE")
            row = db.execute("SELECT * FROM stem_jobs WHERE owner=? AND id=?", (owner, job_id)).fetchone()
            if not row:
                raise JobDenied("JOB_NOT_FOUND")
            if new_status not in ALLOWED[row["status"]]:
                raise JobDenied("ILLEGAL_STATE_TRANSITION")
            db.execute("UPDATE stem_jobs SET status=?, progress=? WHERE id=? AND owner=?",
                       (new_status, progress, job_id, owner))
            return self.as_dict(db.execute("SELECT * FROM stem_jobs WHERE owner=? AND id=?", (owner,job_id)).fetchone())
