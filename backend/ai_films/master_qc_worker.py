"""Production QC gate for durable AI FILMS ACEScg/OpenEXR master packages."""
from __future__ import annotations

import asyncio
import hashlib
import json
import logging
import os
import tempfile
from dataclasses import asdict, dataclass
from pathlib import Path
from typing import Any, Mapping
from urllib.parse import quote

import httpx

from backend.ai_films.artifact_store import AI_FILM_BUCKET, _aggregate_checksum
from backend.ai_films.assembly_worker import SupabaseAssemblyClient, _now
from backend.ai_films.openexr_asset import OpenEXRValidationError, inspect_exr

logger = logging.getLogger(__name__)
QC_VERSION = "ai-films.master-qc.v1"


class MasterQCError(RuntimeError):
    """Raised when a master package cannot be certified."""


@dataclass(frozen=True)
class QCIssue:
    code: str
    message: str
    object_path: str | None = None


@dataclass(frozen=True)
class QCResult:
    passed: bool
    frame_count: int
    checked_objects: int
    checksum: str | None
    issues: tuple[QCIssue, ...]

    def as_json(self) -> dict[str, Any]:
        return {
            "passed": self.passed,
            "frame_count": self.frame_count,
            "checked_objects": self.checked_objects,
            "checksum": self.checksum,
            "issues": [asdict(issue) for issue in self.issues],
            "version": QC_VERSION,
        }


async def _claim_next_job(db: SupabaseAssemblyClient) -> dict[str, Any] | None:
    rows = await db._request(
        "GET",
        "ai_film_render_jobs",
        params={
            "job_type": "eq.mastering",
            "provider": "eq.ffmpeg",
            "status": "eq.completed",
            "output->qa->>state": "eq.pending_master_qa",
            "select": "*",
            "order": "completed_at.asc",
            "limit": "1",
        },
    )
    if not rows:
        return None
    job = rows[0]
    output = dict(job.get("output") or {})
    qa = dict(output.get("qa") or {})
    qa.update({"state": "master_qa_in_progress", "started_at": _now(), "version": QC_VERSION})
    output["qa"] = qa
    claimed = await db._request(
        "PATCH",
        "ai_film_render_jobs",
        params={"id": f"eq.{job['id']}", "output->qa->>state": "eq.pending_master_qa"},
        payload={"output": output, "updated_at": _now()},
        representation=True,
    )
    return claimed[0] if claimed else None


async def _load_package_asset(db: SupabaseAssemblyClient, job: Mapping[str, Any]) -> dict[str, Any]:
    output = job.get("output") if isinstance(job.get("output"), dict) else {}
    asset_id = str(output.get("master_package_asset_id") or "")
    project_id = str(job.get("project_id") or "")
    owner_id = str(job.get("owner_id") or "")
    if not asset_id or not project_id or not owner_id:
        raise MasterQCError("Mastering job is missing package/ownership identifiers")
    rows = await db._request(
        "GET",
        "ai_film_assets",
        params={
            "id": f"eq.{asset_id}",
            "project_id": f"eq.{project_id}",
            "owner_id": f"eq.{owner_id}",
            "select": "id,project_id,owner_id,status,checksum,storage_path,metadata,category,subcategory",
            "limit": "1",
        },
    )
    if not rows:
        raise MasterQCError("Master package asset is unavailable or ownership-scoped lookup failed")
    return rows[0]


async def _download_object(db: SupabaseAssemblyClient, object_path: str, destination: Path) -> str:
    encoded = "/".join(quote(part, safe="") for part in object_path.split("/"))
    headers = {"apikey": db.service_key, "Authorization": f"Bearer {db.service_key}"}
    async with httpx.AsyncClient(timeout=httpx.Timeout(120.0, connect=15.0)) as client:
        response = await client.get(
            f"{db.base_url}/storage/v1/object/{quote(AI_FILM_BUCKET, safe='')}/{encoded}",
            headers=headers,
        )
    if response.status_code >= 400:
        raise MasterQCError(f"Storage object unavailable ({response.status_code}): {object_path}")
    destination.parent.mkdir(parents=True, exist_ok=True)
    destination.write_bytes(response.content)
    return hashlib.sha256(response.content).hexdigest()


def _validate_exr(path: Path, *, width: int, height: int, object_path: str) -> list[QCIssue]:
    issues: list[QCIssue] = []
    try:
        info = inspect_exr(path, require_rgb=True)
    except (OpenEXRValidationError, OSError, RuntimeError) as exc:
        return [QCIssue("exr.invalid", str(exc), object_path)]
    if info.width != width or info.height != height:
        issues.append(QCIssue("exr.dimensions", f"EXR dimensions {info.width}x{info.height} do not match package {width}x{height}", object_path))
    if str(info.metadata.get("aiFilmsWorkingSpace") or "") != "ACEScg":
        issues.append(QCIssue("exr.colorspace", "EXR is not tagged ACEScg", object_path))
    if str(info.metadata.get("aiFilmsMasterContainer") or "") != "OpenEXR":
        issues.append(QCIssue("exr.master_container", "EXR is missing OpenEXR master tag", object_path))
    if "aiFilmsSourcePTSSeconds" not in info.metadata:
        issues.append(QCIssue("exr.pts", "EXR is missing source PTS provenance", object_path))
    if "aiFilmsSourceTimecode" not in info.metadata:
        issues.append(QCIssue("exr.timecode", "EXR is missing source timecode provenance", object_path))
    return issues


def _validate_editorial(conform_path: Path, otio_path: Path, frame_count: int, frame_rate: float) -> list[QCIssue]:
    issues: list[QCIssue] = []
    try:
        conform = json.loads(conform_path.read_text(encoding="utf-8"))
    except Exception as exc:
        return [QCIssue("conform.invalid_json", f"Editorial conform JSON is invalid: {exc}")]

    frames = conform.get("frames")
    if not isinstance(frames, list) or len(frames) != frame_count:
        issues.append(QCIssue("conform.frame_count", "Editorial conform frame count does not match package"))
    else:
        pts: list[float] = []
        for item in frames:
            if not isinstance(item, dict):
                issues.append(QCIssue("conform.frame_shape", "Editorial conform contains a non-object frame"))
                continue
            try:
                pts.append(float(item.get("source_pts_seconds")))
            except (TypeError, ValueError):
                issues.append(QCIssue("conform.pts", "Editorial conform contains an invalid PTS"))
            if not item.get("source_timecode"):
                issues.append(QCIssue("conform.timecode", "Editorial conform frame is missing source timecode"))
        if any(b < a for a, b in zip(pts, pts[1:])):
            issues.append(QCIssue("conform.pts_order", "Editorial PTS values are not monotonic"))

    try:
        numerator = int(conform.get("frame_rate_numerator"))
        denominator = int(conform.get("frame_rate_denominator"))
        if denominator <= 0 or abs((numerator / denominator) - frame_rate) > 0.002:
            issues.append(QCIssue("conform.frame_rate", "Editorial conform frame rate does not match package"))
    except (TypeError, ValueError, ZeroDivisionError):
        issues.append(QCIssue("conform.frame_rate", "Editorial conform rational frame rate is invalid"))

    try:
        otio = json.loads(otio_path.read_text(encoding="utf-8"))
    except Exception as exc:
        issues.append(QCIssue("otio.invalid_json", f"OTIO JSON is invalid: {exc}"))
        return issues
    if not isinstance(otio, dict) or "OTIO_SCHEMA" not in otio:
        issues.append(QCIssue("otio.schema", "OTIO payload is missing OTIO_SCHEMA"))
    tracks = otio.get("tracks") if isinstance(otio, dict) else None
    if not isinstance(tracks, dict) or not isinstance(tracks.get("children"), list) or not tracks.get("children"):
        issues.append(QCIssue("otio.tracks", "OTIO timeline has no populated video track"))
    return issues


async def certify_master_package(job: Mapping[str, Any], db: SupabaseAssemblyClient) -> QCResult:
    asset = await _load_package_asset(db, job)
    metadata = asset.get("metadata") if isinstance(asset.get("metadata"), dict) else {}
    output = job.get("output") if isinstance(job.get("output"), dict) else {}
    frame_paths = metadata.get("frame_paths") if isinstance(metadata.get("frame_paths"), list) else []
    editorial_path = str(metadata.get("editorial_manifest_path") or "")
    otio_path = str(metadata.get("otio_timeline_path") or "")
    expected_count = int(metadata.get("frame_count") or output.get("frame_count") or 0)
    width = int(metadata.get("width") or output.get("width") or 0)
    height = int(metadata.get("height") or output.get("height") or 0)
    frame_rate = float(metadata.get("frame_rate") or output.get("frame_rate") or 0)

    issues: list[QCIssue] = []
    if str(metadata.get("schema") or "") != "ai-films.master-package.v1":
        issues.append(QCIssue("package.schema", "Master package schema is missing or unsupported"))
    if expected_count <= 0 or len(frame_paths) != expected_count:
        issues.append(QCIssue("package.frame_count", "Registered frame paths do not match expected frame count"))
    if width <= 0 or height <= 0 or frame_rate <= 0:
        issues.append(QCIssue("package.video_metadata", "Package dimensions/frame rate are invalid"))
    if not editorial_path or not otio_path:
        issues.append(QCIssue("package.editorial", "Package is missing editorial conform/OTIO paths"))
    if issues:
        return QCResult(False, expected_count, 0, None, tuple(issues))

    checksums: list[tuple[str, str]] = []
    with tempfile.TemporaryDirectory(prefix="d3vonn-master-qc-") as tmp:
        root = Path(tmp)
        for index, object_path in enumerate(frame_paths):
            if not isinstance(object_path, str) or not object_path.endswith(".exr"):
                issues.append(QCIssue("package.frame_path", "Invalid EXR frame path", str(object_path)))
                continue
            local = root / f"frame_{index:08d}.exr"
            try:
                digest = await _download_object(db, object_path, local)
                checksums.append((object_path, digest))
                issues.extend(_validate_exr(local, width=width, height=height, object_path=object_path))
            except MasterQCError as exc:
                issues.append(QCIssue("storage.missing", str(exc), object_path))

        local_conform = root / "editorial_conform.json"
        local_otio = root / "editorial_conform.otio"
        try:
            digest = await _download_object(db, editorial_path, local_conform)
            checksums.append((editorial_path, digest))
        except MasterQCError as exc:
            issues.append(QCIssue("storage.conform", str(exc), editorial_path))
        try:
            digest = await _download_object(db, otio_path, local_otio)
            checksums.append((otio_path, digest))
        except MasterQCError as exc:
            issues.append(QCIssue("storage.otio", str(exc), otio_path))
        if local_conform.exists() and local_otio.exists():
            issues.extend(_validate_editorial(local_conform, local_otio, expected_count, frame_rate))

    aggregate = _aggregate_checksum(checksums) if len(checksums) == expected_count + 2 else None
    registered_checksum = str(asset.get("checksum") or "")
    if aggregate is None or aggregate != registered_checksum or aggregate != str(output.get("checksum") or ""):
        issues.append(QCIssue("package.checksum", "Durable package checksum does not match registered provenance"))
    return QCResult(not issues, expected_count, len(checksums), aggregate, tuple(issues))


async def _record_result(job: Mapping[str, Any], db: SupabaseAssemblyClient, result: QCResult) -> None:
    output = dict(job.get("output") or {})
    qa = dict(output.get("qa") or {})
    qa.update({"state": "master_qa_passed" if result.passed else "master_qa_failed", "completed_at": _now(), "certification": result.as_json()})
    output["qa"] = qa
    await db.update_job(str(job.get("id") or ""), {"output": output})

    asset_id = str(output.get("master_package_asset_id") or "")
    if not asset_id:
        return
    rows = await db._request("GET", "ai_film_assets", params={"id": f"eq.{asset_id}", "select": "metadata", "limit": "1"})
    metadata = dict(rows[0].get("metadata") or {}) if rows else {}
    metadata["master_qc"] = {**result.as_json(), "certified_at": _now()}
    await db._request(
        "PATCH",
        "ai_film_assets",
        params={"id": f"eq.{asset_id}", "project_id": f"eq.{job.get('project_id')}", "owner_id": f"eq.{job.get('owner_id')}"},
        payload={"status": "approved" if result.passed else "draft", "metadata": metadata},
    )


async def run_master_qc_worker(*, environ: Mapping[str, str] | None = None, once: bool = False) -> None:
    source = environ or os.environ
    if str(source.get("RAILWAY_ENVIRONMENT_NAME", "")).strip().lower() != "production":
        logger.info("AI FILMS master QC worker skipped outside production Railway.")
        return
    if str(source.get("AI_FILM_MASTER_QC_WORKER_ENABLED", "true")).strip().lower() in {"0", "false", "no", "off"}:
        logger.info("AI FILMS master QC worker disabled by environment.")
        return
    db = SupabaseAssemblyClient(source)
    poll = max(2.0, float(source.get("AI_FILM_MASTER_QC_POLL_SECONDS", "8") or 8))
    while True:
        job = await _claim_next_job(db)
        if not job:
            if once:
                return
            await asyncio.sleep(poll)
            continue
        try:
            result = await certify_master_package(job, db)
            await _record_result(job, db, result)
            logger.info("AI FILMS master QC %s for job %s", "passed" if result.passed else "failed", job.get("id"))
        except Exception as exc:
            logger.exception("AI FILMS master QC crashed for job %s", job.get("id"))
            output = dict(job.get("output") or {})
            qa = dict(output.get("qa") or {})
            qa.update({"state": "master_qa_failed", "completed_at": _now(), "error": f"{type(exc).__name__}: {exc}"[:2000]})
            output["qa"] = qa
            await db.update_job(str(job.get("id") or ""), {"output": output})
        if once:
            return
