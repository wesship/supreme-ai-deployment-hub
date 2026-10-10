from __future__ import annotations

import json
from pathlib import Path

import pytest

from backend.ai_films.master_qc_worker import (
    QCResult,
    QCIssue,
    _load_package_asset,
    _record_result,
    _validate_editorial,
    run_master_qc_worker,
)


def _write_editorial(tmp_path: Path, *, pts=(0.0, 1 / 24)) -> tuple[Path, Path]:
    conform = {
        "source_path": "source.mov",
        "frame_rate_numerator": 24,
        "frame_rate_denominator": 1,
        "start_timecode": "01:00:00:00",
        "frames": [
            {
                "frame_number": i + 1,
                "exr_path": f"frame_{i + 1:08d}.exr",
                "source_frame_index": i,
                "source_pts_seconds": value,
                "source_timecode": f"01:00:00:{i:02d}",
            }
            for i, value in enumerate(pts)
        ],
    }
    otio = {
        "OTIO_SCHEMA": "Timeline.1",
        "tracks": {
            "OTIO_SCHEMA": "Stack.1",
            "children": [{"OTIO_SCHEMA": "Track.1", "children": [{"OTIO_SCHEMA": "Clip.2"}]}],
        },
    }
    conform_path = tmp_path / "editorial_conform.json"
    otio_path = tmp_path / "editorial_conform.otio"
    conform_path.write_text(json.dumps(conform), encoding="utf-8")
    otio_path.write_text(json.dumps(otio), encoding="utf-8")
    return conform_path, otio_path


def test_editorial_qc_accepts_real_manifest_shape(tmp_path: Path):
    conform, otio = _write_editorial(tmp_path)
    assert _validate_editorial(conform, otio, 2, 24.0) == []


def test_editorial_qc_rejects_non_monotonic_pts(tmp_path: Path):
    conform, otio = _write_editorial(tmp_path, pts=(1.0, 0.5))
    issues = _validate_editorial(conform, otio, 2, 24.0)
    assert any(issue.code == "conform.pts_order" for issue in issues)


def test_editorial_qc_rejects_empty_otio_track(tmp_path: Path):
    conform, otio = _write_editorial(tmp_path)
    payload = json.loads(otio.read_text(encoding="utf-8"))
    payload["tracks"]["children"] = []
    otio.write_text(json.dumps(payload), encoding="utf-8")
    issues = _validate_editorial(conform, otio, 2, 24.0)
    assert any(issue.code == "otio.tracks" for issue in issues)


@pytest.mark.asyncio
async def test_qc_worker_skips_outside_production():
    await run_master_qc_worker(environ={"RAILWAY_ENVIRONMENT_NAME": "staging"}, once=True)


class FakeDB:
    def __init__(self, rows=None):
        self.rows = rows or []
        self.calls = []
        self.updated = []

    async def _request(self, method, table, *, params=None, payload=None, representation=False):
        self.calls.append((method, table, params, payload, representation))
        if method == "GET":
            return self.rows
        return []

    async def update_job(self, job_id, updates):
        self.updated.append((job_id, updates))


@pytest.mark.asyncio
async def test_package_lookup_is_owner_and_project_scoped():
    db = FakeDB([
        {"id": "asset", "project_id": "project", "owner_id": "owner", "metadata": {}}
    ])
    job = {
        "id": "job",
        "project_id": "project",
        "owner_id": "owner",
        "output": {"master_package_asset_id": "asset"},
    }
    await _load_package_asset(db, job)
    params = db.calls[0][2]
    assert params["id"] == "eq.asset"
    assert params["project_id"] == "eq.project"
    assert params["owner_id"] == "eq.owner"


@pytest.mark.asyncio
async def test_failed_qc_never_promotes_asset():
    db = FakeDB([{"metadata": {"schema": "ai-films.master-package.v1"}}])
    job = {
        "id": "job",
        "project_id": "project",
        "owner_id": "owner",
        "output": {"master_package_asset_id": "asset", "qa": {"state": "master_qa_in_progress"}},
    }
    result = QCResult(False, 2, 3, None, (QCIssue("package.checksum", "bad"),))
    await _record_result(job, db, result)
    patch_calls = [call for call in db.calls if call[0] == "PATCH" and call[1] == "ai_film_assets"]
    assert patch_calls
    assert patch_calls[-1][3]["status"] == "draft"
    assert db.updated[-1][1]["output"]["qa"]["state"] == "master_qa_failed"


@pytest.mark.asyncio
async def test_passing_qc_promotes_only_to_approved():
    db = FakeDB([{"metadata": {}}])
    job = {
        "id": "job",
        "project_id": "project",
        "owner_id": "owner",
        "output": {"master_package_asset_id": "asset", "qa": {"state": "master_qa_in_progress"}},
    }
    result = QCResult(True, 2, 4, "abc", ())
    await _record_result(job, db, result)
    patch_calls = [call for call in db.calls if call[0] == "PATCH" and call[1] == "ai_film_assets"]
    assert patch_calls[-1][3]["status"] == "approved"
    assert patch_calls[-1][3]["status"] != "canon"
