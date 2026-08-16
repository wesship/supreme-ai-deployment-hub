from __future__ import annotations

import json
from pathlib import Path

import httpx
import pytest

from backend.ai_films.artifact_store import (
    ArtifactStoreError,
    ArtifactTooLargeError,
    MAX_OBJECT_BYTES,
    SupabaseArtifactStore,
)
from backend.ai_films.frame_sequence import FrameSequenceManifest


def _manifest(tmp_path: Path) -> FrameSequenceManifest:
    frame1 = tmp_path / "frame_00000001.exr"
    frame2 = tmp_path / "frame_00000002.exr"
    editorial = tmp_path / "editorial_conform.json"
    otio = tmp_path / "editorial_conform.otio"
    frame1.write_bytes(b"exr-one")
    frame2.write_bytes(b"exr-two")
    editorial.write_text('{"frames": 2}', encoding="utf-8")
    otio.write_text('{"OTIO_SCHEMA": "Timeline.1"}', encoding="utf-8")
    return FrameSequenceManifest(
        source_path="camera.mov",
        output_directory=str(tmp_path),
        width=1920,
        height=1080,
        frame_rate=24.0,
        frame_count=2,
        source_color_space="ACEScg",
        frames=(str(frame1), str(frame2)),
        editorial_manifest_path=str(editorial),
        otio_timeline_path=str(otio),
    )


@pytest.mark.asyncio
async def test_persist_package_uploads_files_and_registers_one_asset(tmp_path: Path):
    manifest = _manifest(tmp_path)
    uploads: list[tuple[str, str]] = []
    registered: list[dict] = []

    def handler(request: httpx.Request) -> httpx.Response:
        if request.url.path == "/rest/v1/ai_film_projects":
            return httpx.Response(200, json=[{"owner_id": "owner-123"}])
        if request.url.path.startswith("/storage/v1/object/ai-film-media/"):
            uploads.append((request.url.path, request.headers.get("content-type", "")))
            return httpx.Response(200, json={"Key": request.url.path})
        if request.url.path == "/rest/v1/ai_film_assets":
            registered.append(json.loads(request.content))
            return httpx.Response(201, json=[{"id": "asset-456"}])
        raise AssertionError(f"Unexpected request: {request.method} {request.url}")

    client = httpx.AsyncClient(transport=httpx.MockTransport(handler))
    store = SupabaseArtifactStore(
        supabase_url="https://example.supabase.co",
        service_role_key="service-role-test",
        client=client,
        max_concurrency=2,
    )
    try:
        package = await store.persist_frame_sequence_package(
            project_id="project-1",
            shot_id="shot-7",
            manifest=manifest,
        )
    finally:
        await client.aclose()

    assert package.asset_id == "asset-456"
    assert package.owner_id == "owner-123"
    assert len(package.frame_paths) == 2
    assert len(uploads) == 4
    mime_types = {mime for _, mime in uploads}
    assert "image/x-exr" in mime_types
    assert "application/json" in mime_types
    assert len(registered) == 1
    payload = registered[0]
    assert payload["asset_type"] == "other"
    assert payload["category"] == "master"
    assert payload["metadata"]["frame_count"] == 2
    assert payload["metadata"]["otio_timeline_path"].endswith("editorial_conform.otio")
    assert payload["checksum"] == package.checksum


@pytest.mark.asyncio
async def test_registration_failure_removes_uploaded_objects(tmp_path: Path):
    manifest = _manifest(tmp_path)
    cleanup_payloads: list[dict] = []

    def handler(request: httpx.Request) -> httpx.Response:
        if request.url.path == "/rest/v1/ai_film_projects":
            return httpx.Response(200, json=[{"owner_id": "owner-123"}])
        if request.method == "POST" and request.url.path.startswith("/storage/v1/object/ai-film-media/"):
            return httpx.Response(200, json={"Key": request.url.path})
        if request.url.path == "/rest/v1/ai_film_assets":
            return httpx.Response(500, json={"message": "db unavailable"})
        if request.method == "DELETE" and request.url.path == "/storage/v1/object/ai-film-media":
            cleanup_payloads.append(json.loads(request.content))
            return httpx.Response(200, json=[])
        raise AssertionError(f"Unexpected request: {request.method} {request.url}")

    client = httpx.AsyncClient(transport=httpx.MockTransport(handler))
    store = SupabaseArtifactStore(
        supabase_url="https://example.supabase.co",
        service_role_key="service-role-test",
        client=client,
    )
    try:
        with pytest.raises(ArtifactStoreError):
            await store.persist_frame_sequence_package(
                project_id="project-1",
                shot_id="shot-7",
                manifest=manifest,
            )
    finally:
        await client.aclose()

    assert cleanup_payloads
    assert len(cleanup_payloads[0]["prefixes"]) == 4


def test_too_large_artifact_is_rejected_before_upload(tmp_path: Path, monkeypatch):
    from backend.ai_films import artifact_store

    path = tmp_path / "frame.exr"
    path.write_bytes(b"x")

    class FakeStat:
        st_size = MAX_OBJECT_BYTES + 1

    monkeypatch.setattr(Path, "stat", lambda self: FakeStat())
    with pytest.raises(ArtifactTooLargeError):
        artifact_store._require_file(path)
