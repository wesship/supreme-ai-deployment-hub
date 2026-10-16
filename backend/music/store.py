"""Single-host pilot spool; API and worker must share a persistent local volume."""
from contextlib import contextmanager
import json
import os
from pathlib import Path
import sqlite3
import time


def root():
    path = Path(os.environ["MUSIC_STEM_DATA_DIR"]).resolve()
    path.mkdir(parents=True, exist_ok=True, mode=0o700)
    return path


@contextmanager
def connect():
    db = sqlite3.connect(root() / "jobs.sqlite", timeout=10)
    db.row_factory = sqlite3.Row
    try:
        db.execute("""CREATE TABLE IF NOT EXISTS jobs (
            id TEXT PRIMARY KEY, owner TEXT NOT NULL, mode TEXT NOT NULL,
            status TEXT NOT NULL, created REAL NOT NULL, updated REAL NOT NULL,
            outputs TEXT NOT NULL DEFAULT '{}', error TEXT, options TEXT NOT NULL DEFAULT '{}')""")
        if 'options' not in {row['name'] for row in db.execute('PRAGMA table_info(jobs)')}:
            try:
                db.execute("ALTER TABLE jobs ADD COLUMN options TEXT NOT NULL DEFAULT '{}'")
            except sqlite3.OperationalError:
                if 'options' not in {row['name'] for row in db.execute('PRAGMA table_info(jobs)')}:
                    raise
        db.commit()
        with db:
            yield db
    finally:
        db.close()



def get_job(job_id, owner):
    with connect() as db:
        db.execute("UPDATE jobs SET status='failed', error='Processing timed out; submit again', updated=? WHERE id=? AND owner=? AND status IN ('queued','processing') AND updated<?",
                   (time.time(), job_id, owner, time.time() - 4500))
        row = db.execute("SELECT * FROM jobs WHERE id=? AND owner=?", (job_id, owner)).fetchone()
    if row is None:
        return None
    result = dict(row)
    result["outputs"] = json.loads(result["outputs"])
    return result


def claim():
    with connect() as db:
        db.execute("BEGIN IMMEDIATE")
        # A killed worker must never leave a job 'processing' forever. Do not
        # retry implicitly: model processing may have already written artifacts.
        db.execute("UPDATE jobs SET status='failed', error='Worker interrupted; submit again', updated=? WHERE status='processing' AND updated<?", (time.time(), time.time() - 4500))
        row = db.execute("SELECT * FROM jobs WHERE status='queued' ORDER BY created LIMIT 1").fetchone()
        if row:
            db.execute("UPDATE jobs SET status='processing', updated=? WHERE id=?", (time.time(), row["id"]))
        return dict(row) if row else None


def finish(job_id, outputs=None, error=None):
    with connect() as db:
        db.execute("UPDATE jobs SET status=?, outputs=?, error=?, updated=? WHERE id=?",
                   ("failed" if error else "completed", json.dumps(outputs or {}), error, time.time(), job_id))
