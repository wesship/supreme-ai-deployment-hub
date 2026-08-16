from __future__ import annotations

import asyncio
from dataclasses import dataclass
import hashlib
import mimetypes
import os
from pathlib import Path
from typing import Any, Iterable
from urllib.parse import quote
from uuid import uuid4

import httpx

from backend.ai_films.frame_sequence import FrameSequenceManifest

AI_FILM_BUCKET = "ai-film-media"
MAX_OBJECT_BYTES = 52_428_800


class ArtifactStoreError(RuntimeError):
    """Base error for durable AI FILMS artifact persistence."""


class ArtifactStoreConfigurationError(ArtifactStoreError):
    """Raised when required Supabase server credentials are unavailable."""


class ArtifactTooLargeError(ArtifactStoreError):
    """Raised before upload when a generated object exceeds the bucket limit."""


@dataclass(frozen=True)
class StoredMasterPackage:
    asset_id: str
    project_id: str
    owner_id: str
    package_prefix: str
    storage_path: str
    frame_paths: tuple[str, ...]
    editorial_manifest_path: str
    otio_timeline_path: str
    checksum: str


def _sha256(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as stream:
        for block in iter(lambda: stream.read(1024 * 1024), b""):
            digest.update(block)
    return digest.hexdigest()


def _content_type(path: Path) -> str:
    suffix = path.suffix.lower()
    if suffix == ".exr":
        return "image/x-exr"
    if suffix in {".json", ".otio"}:
        return "application/json"
    return mimetypes.guess_type(path.name)[0] or "application/octet-stream"


def _require_file(path: str | Path) -> Path:
    candidate = Path(path)
    if not candidate.is_file():
        raise ArtifactStoreError(f"Generated artifact does not exist: {candidate}")
    size = candidate.stat().st_size
    if size > MAX_OBJECT_BYTES:
        raise ArtifactTooLargeError(
            f"Generated artifact {candidate.name} is {size} bytes; "
            f"ai-film-media currently allows {MAX_OBJECT_BYTES} bytes per object"
        )
    return candidate


def _aggregate_checksum(entries: Iterable[tuple[str, str]]) -> str:
    digest = hashlib.sha256()
    for name, checksum in sorted(entries):
        digest.update(name.encode("utf-8"))
        digest.update(b"\0")
        digest.update(checksum.encode("ascii"))
        digest.update(b"\n")
    return digest.hexdigest()


class SupabaseArtifactStore:
    """Persist generated AI FILMS masters with the server-side service role.

    The storage bucket stays private. Object paths begin with the project's owner UUID,
    matching the existing authenticated-user storage policies when signed/read access is
    later issued to the owner. The service role is used only on the backend.
    """

    def __init__(
        self,
        *,
        supabase_url: str,
        service_role_key: str,
        client: httpx.AsyncClient | None = None,
        max_concurrency: int = 6,
    ) -> None:
        if not supabase_url or not service_role_key:
            raise ArtifactStoreConfigurationError(
                "SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required"
            )
        self.supabase_url = supabase_url.rstrip("/")
        self.service_role_key = service_role_key
        self.max_concurrency = max(1, max_concurrency)
        self._owns_client = client is None
        self.client = client or httpx.AsyncClient(timeout=httpx.Timeout(120.0))

    @classmethod
    def from_env(cls, **kwargs: Any) -> "SupabaseArtifactStore":
        return cls(
            supabase_url=os.getenv("SUPABASE_URL", ""),
            service_role_key=os.getenv("SUPABASE_SERVICE_ROLE_KEY", ""),
            **kwargs,
        )

    async def aclose(self) -> None:
        if self._owns_client:
            await self.client.aclose()

    @property
    def _headers(self) -> dict[str, str]:
        return {
            "apikey": self.service_role_key,
            "Authorization": f"Bearer {self.service_role_key}",
        }

    async def resolve_project_owner(self, project_id: str) -> str:
        response = await self.client.get(
            f"{self.supabase_url}/rest/v1/ai_film_projects",
            headers={**self._headers, "Accept": "application/json"},
            params={"id": f"eq.{project_id}", "select": "owner_id", "limit": "1"},
        )
        if response.status_code >= 400:
            raise ArtifactStoreError(
                f"Unable to resolve AI FILMS project owner: HTTP {response.status_code}"
            )
        rows = response.json()
        if not rows or not rows[0].get("owner_id"):
            raise ArtifactStoreError(f"AI FILMS project not found: {project_id}")
        return str(rows[0]["owner_id"])

    async def _upload(self, local_path: Path, object_path: str) -> str:
        encoded = quote(object_path, safe="/")
        with local_path.open("rb") as stream:
            response = await self.client.post(
                f"{self.supabase_url}/storage/v1/object/{AI_FILM_BUCKET}/{encoded}",
                headers={
                    **self._headers,
                    "Content-Type": _content_type(local_path),
                    "x-upsert": "false",
                },
                content=stream.read(),
            )
        if response.status_code not in {200, 201}:
            raise ArtifactStoreError(
                f"Storage upload failed for {local_path.name}: HTTP {response.status_code}"
            )
        return object_path

    async def _remove_uploaded(self, object_paths: list[str]) -> None:
        if not object_paths:
            return
        try:
            await self.client.request(
                "DELETE",
                f"{self.supabase_url}/storage/v1/object/{AI_FILM_BUCKET}",
                headers={**self._headers, "Content-Type": "application/json"},
                json={"prefixes": object_paths},
            )
        except Exception:
            # Cleanup is best effort; preserve the original persistence exception.
            pass

    async def _register_package(
        self,
        *,
        project_id: str,
        owner_id: str,
        manifest: FrameSequenceManifest,
        package_prefix: str,
        storage_path: str,
        frame_paths: tuple[str, ...],
        editorial_manifest_path: str,
        otio_timeline_path: str,
        checksum: str,
    ) -> str:
        payload = {
            "project_id": project_id,
            "owner_id": owner_id,
            "asset_type": "other",
            "title": f"{Path(manifest.source_path).stem} ACEScg master package",
            "description": "AI FILMS durable ACEScg/OpenEXR master sequence with editorial conform",
            "storage_path": storage_path,
            "source_filename": Path(manifest.source_path).name,
            "category": "master",
            "subcategory": "acescg_openexr_sequence",
            "status": "draft",
            "tags": ["openexr", "acescg", "otio", "editorial-conform", "generated-master"],
            "metadata": {
                "schema": "ai-films.master-package.v1",
                "package_prefix": package_prefix,
                "frame_count": manifest.frame_count,
                "frame_rate": manifest.frame_rate,
                "width": manifest.width,
                "height": manifest.height,
                "source_color_space": manifest.source_color_space,
                "frame_paths": list(frame_paths),
                "editorial_manifest_path": editorial_manifest_path,
                "otio_timeline_path": otio_timeline_path,
            },
            "checksum": checksum,
        }
        response = await self.client.post(
            f"{self.supabase_url}/rest/v1/ai_film_assets",
            headers={
                **self._headers,
                "Content-Type": "application/json",
                "Prefer": "return=representation",
            },
            json=payload,
        )
        if response.status_code not in {200, 201}:
            raise ArtifactStoreError(
                f"Unable to register AI FILMS master package: HTTP {response.status_code}"
            )
        rows = response.json()
        if not rows or not rows[0].get("id"):
            raise ArtifactStoreError("AI FILMS asset registration returned no asset id")
        return str(rows[0]["id"])

    async def persist_frame_sequence_package(
        self,
        *,
        project_id: str,
        shot_id: str,
        manifest: FrameSequenceManifest,
        owner_id: str | None = None,
    ) -> StoredMasterPackage:
        """Upload a generated frame package and register one durable AI FILMS asset."""
        if not manifest.editorial_manifest_path or not manifest.otio_timeline_path:
            raise ArtifactStoreError(
                "Frame sequence has no editorial manifest/OTIO output; run editorial roundtrip first"
            )
        owner = owner_id or await self.resolve_project_owner(project_id)
        frame_files = tuple(_require_file(path) for path in manifest.frames)
        editorial_file = _require_file(manifest.editorial_manifest_path)
        otio_file = _require_file(manifest.otio_timeline_path)
        package_id = str(uuid4())
        package_prefix = f"{owner}/{project_id}/shots/{shot_id}/masters/{package_id}"

        local_files = (*frame_files, editorial_file, otio_file)
        checksums = {path: _sha256(path) for path in local_files}
        object_paths = {
            path: f"{package_prefix}/{path.name}" for path in local_files
        }
        uploaded: list[str] = []
        semaphore = asyncio.Semaphore(self.max_concurrency)

        async def upload_one(path: Path) -> str:
            async with semaphore:
                result = await self._upload(path, object_paths[path])
                uploaded.append(result)
                return result

        try:
            await asyncio.gather(*(upload_one(path) for path in local_files))
            stored_frames = tuple(object_paths[path] for path in frame_files)
            stored_editorial = object_paths[editorial_file]
            stored_otio = object_paths[otio_file]
            checksum = _aggregate_checksum(
                (object_paths[path], checksums[path]) for path in local_files
            )
            asset_id = await self._register_package(
                project_id=project_id,
                owner_id=owner,
                manifest=manifest,
                package_prefix=package_prefix,
                storage_path=stored_otio,
                frame_paths=stored_frames,
                editorial_manifest_path=stored_editorial,
                otio_timeline_path=stored_otio,
                checksum=checksum,
            )
        except Exception:
            await self._remove_uploaded(uploaded)
            raise

        return StoredMasterPackage(
            asset_id=asset_id,
            project_id=project_id,
            owner_id=owner,
            package_prefix=package_prefix,
            storage_path=stored_otio,
            frame_paths=stored_frames,
            editorial_manifest_path=stored_editorial,
            otio_timeline_path=stored_otio,
            checksum=checksum,
        )
