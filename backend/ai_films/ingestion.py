"""Batch ingestion helpers for D3VONN.IO AI Films + TwelveLabs v1.3."""

from __future__ import annotations

import argparse
import asyncio
import json
import mimetypes
import time
from pathlib import Path
from typing import Any, Mapping
from urllib.parse import urlsplit, urlunsplit

import httpx

from backend.ai_films.twelvelabs import TwelveLabsClient, TwelveLabsError


def normalize_movieflow_media_url(url: str) -> str:
    """Remove only MovieFlow's preview transform while preserving signed URL parameters."""
    parts = urlsplit(url)
    if parts.hostname == "oss1.movieflow.ai" and parts.path.lower().endswith(".mp4"):
        query_parts = [
            part
            for part in parts.query.split("&")
            if part and part.split("=", 1)[0].lower() != "x-oss-process"
        ]
        return urlunsplit(
            (parts.scheme, parts.netloc, parts.path, "&".join(query_parts), parts.fragment)
        )
    return url


def load_manifest(path: str | Path) -> dict[str, Any]:
    payload = json.loads(Path(path).read_text())
    if not isinstance(payload, dict) or not isinstance(payload.get("assets"), list):
        raise ValueError("AI Films ingestion manifest must contain an assets array")
    return payload


def normalize_asset_type(value: object, filename: str | None = None) -> str:
    """Return a TwelveLabs knowledge-store asset type for video or image media."""
    requested = str(value or "").strip().lower()
    if requested in {"video", "image"}:
        return requested
    mime, _ = mimetypes.guess_type(filename or "")
    return "image" if mime and mime.startswith("image/") else "video"


def media_content_type(asset_type: str, filename: str | None = None) -> str:
    guessed, _ = mimetypes.guess_type(filename or "")
    if guessed and guessed.startswith(f"{asset_type}/"):
        return guessed
    return "image/jpeg" if asset_type == "image" else "video/mp4"


def _multipart_fields(data: Mapping[str, str]) -> list[tuple[str, tuple[None, str]]]:
    """Encode scalar fields as multipart/form-data parts for TwelveLabs /assets."""
    return [(key, (None, value)) for key, value in data.items()]


def _is_not_found(exc: TwelveLabsError) -> bool:
    return "HTTP 404" in str(exc)


class TwelveLabsIngestionRunner:
    def __init__(self, client: TwelveLabsClient | None = None) -> None:
        self.client = client or TwelveLabsClient()

    async def _create_asset(
        self,
        *,
        url: str | None = None,
        file_path: str | Path | None = None,
        filename: str | None = None,
        asset_type: str = "video",
        user_metadata: Mapping[str, Any] | None = None,
    ) -> dict[str, Any]:
        data: dict[str, str] = {
            "method": "url" if url else "direct",
            "enable_thumbnail": "true",
            "enable_hls": "false",
        }
        if filename:
            data["filename"] = filename
        if user_metadata:
            data["user_metadata"] = json.dumps(dict(user_metadata), separators=(",", ":"))

        headers = {"x-api-key": self.client.api_key, "Accept": "application/json"}
        endpoint = f"{self.client.api_base_url}/assets"
        try:
            async with httpx.AsyncClient(
                headers=headers,
                timeout=httpx.Timeout(180.0, connect=15.0),
                transport=self.client._transport,
            ) as http:
                if url:
                    data["url"] = normalize_movieflow_media_url(url)
                    response = await http.post(endpoint, files=_multipart_fields(data))
                elif file_path:
                    path = Path(file_path)
                    if not path.is_file():
                        raise TwelveLabsError(f"Local media file does not exist: {path}")
                    with path.open("rb") as handle:
                        multipart = _multipart_fields(data)
                        multipart.append(
                            (
                                "file",
                                (
                                    filename or path.name,
                                    handle,
                                    media_content_type(asset_type, filename or path.name),
                                ),
                            )
                        )
                        response = await http.post(endpoint, files=multipart)
                else:
                    raise TwelveLabsError("An ingestion source URL or local file is required")
        except httpx.HTTPError as exc:
            raise TwelveLabsError("TwelveLabs asset upload could not be completed") from exc

        if response.status_code >= 400:
            raise TwelveLabsError(
                f"TwelveLabs asset upload failed with HTTP {response.status_code}"
            )
        try:
            result = response.json()
        except ValueError as exc:
            raise TwelveLabsError("TwelveLabs returned invalid JSON for asset creation") from exc
        if not isinstance(result, dict):
            raise TwelveLabsError("TwelveLabs returned an unexpected asset response")
        return result

    async def _retrieve_asset(self, asset_id: str) -> dict[str, Any]:
        """Retrieve an asset, falling back to the documented filtered list on 404."""
        try:
            return await self.client._request("GET", f"/assets/{asset_id}")
        except TwelveLabsError as exc:
            if not _is_not_found(exc):
                raise

        listing = await self.client._request(
            "GET",
            "/assets",
            params={"asset_ids": asset_id, "page_limit": 1},
        )
        data = listing.get("data")
        if isinstance(data, list):
            for candidate in data:
                if not isinstance(candidate, dict):
                    continue
                candidate_id = str(candidate.get("_id") or candidate.get("id") or "")
                if candidate_id == asset_id:
                    return candidate
        raise TwelveLabsError(f"TwelveLabs asset {asset_id} is not retrievable")

    async def _wait_for_asset(
        self,
        asset_id: str,
        *,
        timeout_seconds: float = 180.0,
        poll_interval_seconds: float = 3.0,
    ) -> dict[str, Any]:
        deadline = time.monotonic() + timeout_seconds
        while True:
            try:
                asset = await self._retrieve_asset(asset_id)
            except TwelveLabsError as exc:
                if "is not retrievable" not in str(exc) or time.monotonic() >= deadline:
                    raise
                await asyncio.sleep(poll_interval_seconds)
                continue

            status = str(asset.get("status", "")).lower()
            if status == "ready":
                return asset
            if status == "failed":
                raise TwelveLabsError(f"TwelveLabs asset {asset_id} failed processing")
            if time.monotonic() >= deadline:
                raise TwelveLabsError(f"TwelveLabs asset {asset_id} did not become ready in time")
            await asyncio.sleep(poll_interval_seconds)

    async def _create_item(
        self,
        asset_id: str,
        *,
        metadata: Mapping[str, str] | None = None,
        asset_type: str = "video",
    ) -> dict[str, Any]:
        payload: dict[str, Any] = {"asset_id": asset_id, "asset_type": asset_type}
        if metadata:
            payload["metadata"] = {str(k): str(v) for k, v in metadata.items()}
        return await self.client._request(
            "POST",
            f"/knowledge-stores/{self.client.knowledge_store_id}/items",
            payload=payload,
        )

    async def _wait_for_item(
        self,
        item_id: str,
        *,
        timeout_seconds: float = 900.0,
        poll_interval_seconds: float = 5.0,
    ) -> dict[str, Any]:
        deadline = time.monotonic() + timeout_seconds
        while True:
            try:
                item = await self.client._request(
                    "GET",
                    f"/knowledge-stores/{self.client.knowledge_store_id}/items/{item_id}",
                )
            except TwelveLabsError as exc:
                if not _is_not_found(exc) or time.monotonic() >= deadline:
                    raise
                await asyncio.sleep(poll_interval_seconds)
                continue

            status = str(item.get("status", "")).lower()
            if status == "ready":
                return item
            if status == "failed":
                raise TwelveLabsError(
                    f"TwelveLabs knowledge-store item {item_id} failed indexing"
                )
            if time.monotonic() >= deadline:
                raise TwelveLabsError(
                    f"TwelveLabs knowledge-store item {item_id} did not become ready in time"
                )
            await asyncio.sleep(poll_interval_seconds)

    async def ingest_entry(
        self,
        entry: Mapping[str, Any],
        *,
        wait_for_item: bool = False,
    ) -> dict[str, Any]:
        method = str(entry.get("ingestion_method", ""))
        if method == "file_upload" and not entry.get("local_path"):
            return {
                "ai_film_asset_id": entry.get("ai_film_asset_id"),
                "source_id": entry.get("source_id"),
                "status": "materialization_required",
            }

        asset_type = normalize_asset_type(
            entry.get("asset_type"),
            str(entry.get("source_filename") or entry.get("local_path") or ""),
        )
        metadata = {
            "batch_id": entry.get("batch_id", ""),
            "project_id": entry.get("project_id", ""),
            "ai_film_asset_id": entry.get("ai_film_asset_id", ""),
            "source_type": entry.get("source_type", ""),
            "source_id": entry.get("source_id", ""),
            "provider": entry.get("provider", entry.get("source_type", "")),
            "asset_type": asset_type,
        }
        created = await self._create_asset(
            url=entry.get("media_url") if method == "url" else None,
            file_path=entry.get("local_path") if method == "file_upload" else None,
            filename=entry.get("source_filename"),
            asset_type=asset_type,
            user_metadata=metadata,
        )
        asset_id = str(created.get("_id") or created.get("id") or "")
        if not asset_id:
            raise TwelveLabsError("TwelveLabs asset creation returned no id")
        ready_asset = await self._wait_for_asset(asset_id)

        item = await self._create_item(
            asset_id,
            metadata={
                "batch_id": str(entry.get("batch_id", "")),
                "project_id": str(entry.get("project_id", "")),
                "ai_film_asset_id": str(entry.get("ai_film_asset_id", "")),
                "source_type": str(entry.get("source_type", "")),
                "source_id": str(entry.get("source_id", "")),
                "provider": str(entry.get("provider", entry.get("source_type", ""))),
                "asset_type": asset_type,
            },
            asset_type=asset_type,
        )
        item_id = str(item.get("_id") or item.get("id") or "")
        if not item_id:
            raise TwelveLabsError("TwelveLabs item creation returned no id")
        if wait_for_item:
            item = await self._wait_for_item(item_id)

        return {
            "ai_film_asset_id": entry.get("ai_film_asset_id"),
            "source_id": entry.get("source_id"),
            "status": str(item.get("status") or "queued"),
            "twelvelabs_asset_id": asset_id,
            "twelvelabs_item_id": item_id,
            "asset_type": asset_type,
            "asset": ready_asset,
            "item": item,
        }


async def ingest_manifest(
    manifest_path: str | Path,
    *,
    source_type: str | None = None,
    wait_for_items: bool = False,
) -> dict[str, Any]:
    manifest = load_manifest(manifest_path)
    runner = TwelveLabsIngestionRunner()
    results = []
    seen: set[str] = set()
    batch_id = str(manifest.get("batch_id", ""))
    project_id = str(manifest.get("project_id", ""))

    for raw_entry in manifest["assets"]:
        entry = dict(raw_entry)
        entry.setdefault("batch_id", batch_id)
        entry.setdefault("project_id", project_id)
        if source_type and entry.get("source_type") != source_type:
            continue
        source_key = f"{entry.get('source_type')}:{entry.get('source_id')}"
        if source_key in seen:
            continue
        seen.add(source_key)
        results.append(await runner.ingest_entry(entry, wait_for_item=wait_for_items))

    return {
        "batch_id": manifest.get("batch_id"),
        "knowledge_store_id": runner.client.knowledge_store_id,
        "processed": len(results),
        "results": results,
    }


def main() -> None:
    parser = argparse.ArgumentParser(description="Ingest an AI Films manifest into TwelveLabs")
    parser.add_argument("manifest")
    parser.add_argument("--source-type", help="Filter any manifest source_type, for example movieflow, kling, or invideo")
    parser.add_argument("--wait-items", action="store_true")
    args = parser.parse_args()

    result = asyncio.run(
        ingest_manifest(
            args.manifest,
            source_type=args.source_type,
            wait_for_items=args.wait_items,
        )
    )
    print(json.dumps(result, indent=2, default=str))


if __name__ == "__main__":
    main()
