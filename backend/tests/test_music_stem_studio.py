"""Stem Studio API boundaries and worker orchestration (inference mocked)."""
import io
import json
import time
import wave
from types import SimpleNamespace

import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient

from backend.app.middleware.auth import get_current_user_id
from backend.music import store, worker
from backend.music.router import router


@pytest.fixture
def client(monkeypatch, tmp_path):
    monkeypatch.setenv("MUSIC_STEMS_ENABLED", "true")
    monkeypatch.setenv("MUSIC_STEM_DATA_DIR", str(tmp_path))
    app = FastAPI()
    app.include_router(router)
    app.dependency_overrides[get_current_user_id] = lambda: "alice"
    with TestClient(app) as client:
        yield client


def upload(client, name="song.wav", content=b"test", mode="vocals", rights="true"):
    return client.post("/api/music/stems/jobs", files={"file": (name, content)}, data={"mode": mode, "rights_confirmed": rights})


def test_disabled_does_not_accept_upload(client, monkeypatch):
    monkeypatch.delenv("MUSIC_STEMS_ENABLED")
    assert not client.get("/api/music/stems/capabilities").json()["enabled"]
    assert upload(client).status_code == 503
    assert not list(store.root().glob("*/source"))


@pytest.mark.parametrize("name,content,mode,rights,code", [
    ("song.exe", b"a", "vocals", "true", 415),
    ("song.wav", b"", "vocals", "true", 422),
    ("song.wav", b"a", "shell-command", "true", 422),
    ("song.wav", b"a", "vocals", "false", 422),
])
def test_invalid_requests(client, name, content, mode, rights, code):
    assert upload(client, name, content, mode, rights).status_code == code
    with store.connect() as db:
        assert db.execute("SELECT COUNT(*) FROM jobs").fetchone()[0] == 0


def test_size_limit_cleans_partial_upload(client, monkeypatch):
    monkeypatch.setattr("backend.music.router.MAX_BYTES", 2)
    assert upload(client, content=b"123").status_code == 413
    assert not list(store.root().glob("*/source"))


def test_job_ownership_and_uuid_boundary(client):
    result = upload(client)
    assert result.status_code == 202
    job_id = result.json()["id"]
    assert result.json()["status"] == "queued"
    assert client.get(f"/api/music/stems/jobs/{job_id}").json()["status"] == "queued"
    client.app.dependency_overrides[get_current_user_id] = lambda: "bob"
    assert client.get(f"/api/music/stems/jobs/{job_id}").status_code == 404
    assert client.get(f"/api/music/stems/jobs/{job_id}/audio/vocals").status_code == 404
    assert client.get("/api/music/stems/jobs/not-a-uuid").status_code == 422


def test_auth_required(client):
    client.app.dependency_overrides.clear()
    # Force the canonical auth dependency into required mode, without a network call.
    from unittest.mock import patch
    with patch("backend.app.middleware.auth.get_settings", return_value=SimpleNamespace(require_auth=True)):
        assert upload(client).status_code == 401


def test_daily_quota(client):
    for _ in range(10):
        assert upload(client).status_code == 202
    assert upload(client).status_code == 429


def test_claim_once_and_recover_stale(client):
    job_id = upload(client).json()["id"]
    assert store.claim()["id"] == job_id
    assert store.claim() is None
    with store.connect() as db:
        db.execute("UPDATE jobs SET updated=? WHERE id=?", (time.time() - 5000, job_id))
    assert store.claim() is None
    assert store.get_job(job_id, "alice")["status"] == "failed"


def wav_bytes(frames=4410):
    output = io.BytesIO()
    with wave.open(output, "wb") as audio:
        audio.setnchannels(2)
        audio.setsampwidth(2)
        audio.setframerate(44100)
        audio.writeframes(b"\0" * frames * 4)
    return output.getvalue()


@pytest.mark.parametrize("mode,names", [("vocals", ("vocals", "no_vocals")), ("four_stems", worker.STEMS)])
def test_worker_exports_aligned_wav_and_owner_can_download(client, monkeypatch, mode, names):
    job_id = upload(client, mode=mode, content=wav_bytes()).json()["id"]
    calls = []
    real_run = worker.run
    def fake_run(command, timeout):
        calls.append(command)
        if command[0] == "ffprobe":
            return SimpleNamespace(stdout=json.dumps({"format": {"duration": "0.1"}}).encode())
        if "demucs" in command:
            directory = store.root() / job_id / "separated" / "htdemucs" / "input"
            directory.mkdir(parents=True)
            for name in names:
                (directory / f"{name}.wav").write_bytes(wav_bytes())
            return SimpleNamespace(stdout=b"")
        return real_run(command, timeout)
    monkeypatch.setattr(worker, "run", fake_run)
    worker.process(store.claim())
    result = client.get(f"/api/music/stems/jobs/{job_id}").json()
    assert result["status"] == "completed"
    assert set(result["stems"]) == set(names)
    response = client.get(f"/api/music/stems/jobs/{job_id}/audio/vocals")
    assert response.status_code == 200
    assert response.content == wav_bytes()
    assert client.get(f"/api/music/stems/jobs/{job_id}/audio/vocals?preview=true").status_code == 200
    assert response.headers["cache-control"] == "no-store"
    assert not (store.root() / job_id / "source").exists()
    assert sum("demucs" in command for command in calls) == 1


def test_worker_rejects_invalid_media(client):
    job_id = upload(client, content=b"not audio").json()["id"]
    worker.process(store.claim())  # Real FFprobe invocation.
    result = client.get(f"/api/music/stems/jobs/{job_id}").json()
    assert result["status"] == "failed"
    assert result["stems"] == []


def test_output_traversal_is_rejected(client):
    job_id = upload(client).json()["id"]
    outside = store.root() / "private.wav"
    outside.write_bytes(b"private")
    store.finish(job_id, {"vocals": "../private.wav"})
    assert client.get(f"/api/music/stems/jobs/{job_id}/audio/vocals").status_code == 404


def test_cleanup_expires_files_and_records(client):
    job_id = upload(client).json()["id"]
    store.finish(job_id, error="failed")
    with store.connect() as db:
        db.execute("UPDATE jobs SET created=? WHERE id=?", (time.time() - 90000, job_id))
    worker.cleanup()
    assert store.get_job(job_id, "alice") is None
    assert not (store.root() / job_id).exists()


def test_queued_job_expires_even_when_worker_is_offline(client):
    job_id = upload(client).json()["id"]
    with store.connect() as db:
        db.execute("UPDATE jobs SET updated=? WHERE id=?", (time.time() - 5000, job_id))
    result = client.get(f"/api/music/stems/jobs/{job_id}").json()
    assert result["status"] == "failed"
    assert "timed out" in result["error"]


def test_worker_rejects_overlong_recording(client, monkeypatch):
    job_id = upload(client).json()["id"]
    monkeypatch.setattr(worker, "run", lambda *_: SimpleNamespace(stdout=b'{"format":{"duration":"601"}}'))
    worker.process(store.claim())
    assert store.get_job(job_id, "alice")["status"] == "failed"
