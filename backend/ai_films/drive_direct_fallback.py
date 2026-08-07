"""Direct Google Drive -> TwelveLabs fallback for Sovereign Signal masters.

The native TwelveLabs Drive import can reject otherwise accessible files as
``source_unavailable``. This fallback reuses the existing active TwelveLabs
Google Drive connection to mint a short-lived read-only picker token, streams
known Drive file IDs into Railway ephemeral storage, uploads them to TwelveLabs
as direct assets, indexes them in the configured knowledge store, and deletes
the temporary files immediately.
"""

from __future__ import annotations

import asyncio
import logging
import os
import tempfile
import time
from pathlib import Path
from typing import Any, Mapping

import httpx

from backend.ai_films.bootstrap import (
    BATCH_ID,
    PROJECT_ID,
    SupabaseFilmBootstrapClient,
    _now,
    should_schedule_sovereign_signal_bootstrap,
)
from backend.ai_films.drive_connector import (
    MANIFEST_PATH,
    _connection_id,
    _list_active_google_drive_connections,
)
from backend.ai_films.ingestion import TwelveLabsIngestionRunner, load_manifest
from backend.ai_films.twelvelabs import (
    TwelveLabsClient,
    TwelveLabsConfigurationError,
    TwelveLabsError,
)

logger = logging.getLogger(__name__)


async def _picker_access_token(
    client: TwelveLabsClient,
    connection_id: str,
) -> str:
    payload = await client._request(
        "POST", f"/connections/{connection_id}/picker-token"
    )
    token = str(payload.get("access_token") or "")
    if not token:
        raise TwelveLabsError("TwelveLabs Drive picker token response contained no access token")
    return token


async def _download_drive_file(
    *,
    access_token: str,
    source_id: str,
    destination: Path,
) -> None:
    url = f"https://www.googleapis.com/drive/v3/files/{source_id}"
    headers = {"Authorization": f"Bearer {access_token}"}
    params = {"alt": "media", "supportsAllDrives": "true"}
    try:
        async with httpx.AsyncClient(
            headers=headers,
            timeout=httpx.Timeout(1800.0, connect=20.0),
            follow_redirects=True,
        ) as http:
            async with http.stream("GET", url, params=params) as response:
                if response.status_code >= 400:
                    raise TwelveLabsError(
                        f"Google Drive download failed with HTTP {response.status_code}"
                    )
                with destination.open("wb") as handle:
                    async for chunk in response.aiter_bytes(1024 * 1024):
                        handle.write(chunk)
    except httpx.HTTPError as exc:
        raise TwelveLabsError("Google Drive download could not be completed") from exc


async def _wait_for_native_drive_attempt(
    db: SupabaseFilmBootstrapClient,
    *,
    timeout_seconds: float = 90.0,
    poll_interval_seconds: float = 3.0,
) -> str:
    """Let the native connector probe finish before starting the fallback."""
    deadline = time.monotonic() + timeout_seconds
    while True:
        project = await db.get_project(PROJECT_ID)
        metadata = dict((project or {}).get("metadata") or {})
        state = str(metadata.get("drive_ingestion_state") or "")
        if state in {"complete", "failed", "authorization_required"}:
            return state
        if time.monotonic() >= deadline:
            return state
        await asyncio.sleep(poll_interval_seconds)


async def _index_direct_drive_entry(
    entry: Mapping[str, Any],
    *,
    connection_id: str,
    client: TwelveLabsClient,
    db: SupabaseFilmBootstrapClient,
    runner: TwelveLabsIngestionRunner,
) -> str:
    source_id = str(entry.get("source_id") or "")
    filename = str(entry.get("source_filename") or f"{source_id}.mp4")
    row = await db.get_asset(source_type="google_drive", source_id=source_id)
    if not row:
        raise RuntimeError(f"AI Films Drive asset row missing for {source_id}")

    row_id = str(row["id"])
    metadata = dict(row.get("metadata") or {})
    if str(metadata.get("twelvelabs_state") or "") == "ready" and metadata.get(
        "twelvelabs_item_id"
    ):
        return "already_ready"

    provider_asset_id = str(metadata.get("twelvelabs_asset_id") or "")
    knowledge_item_id = str(metadata.get("twelvelabs_item_id") or "")
    temp_path: Path | None = None

    try:
        if not provider_asset_id:
            await db.update_asset_metadata(
                row_id,
                {
                    "twelvelabs_state": "drive_direct_downloading",
                    "twelvelabs_last_error": None,
                    "drive_direct_started_at": _now(),
                },
            )
            token = await _picker_access_token(client, connection_id)
            suffix = Path(filename).suffix or ".mp4"
            with tempfile.NamedTemporaryFile(
                prefix="d3vonn-ai-film-",
                suffix=suffix,
                delete=False,
            ) as tmp:
                temp_path = Path(tmp.name)

            await _download_drive_file(
                access_token=token,
                source_id=source_id,
                destination=temp_path,
            )
            await db.update_asset_metadata(
                row_id,
                {
                    "twelvelabs_state": "drive_direct_uploading",
                    "drive_direct_downloaded_bytes": temp_path.stat().st_size,
                },
            )
            created = await runner._create_asset(
                file_path=temp_path,
                filename=filename,
                user_metadata={
                    "batch_id": BATCH_ID,
                    "project_id": PROJECT_ID,
                    "ai_film_asset_id": row_id,
                    "source_type": "google_drive",
                    "source_id": source_id,
                    "ingestion_path": "drive_picker_token_direct_upload",
                },
            )
            provider_asset_id = str(created.get("_id") or created.get("id") or "")
            if not provider_asset_id:
                raise TwelveLabsError("TwelveLabs direct Drive upload returned no asset id")
            await db.update_asset_metadata(
                row_id,
                {
                    "twelvelabs_asset_id": provider_asset_id,
                    "twelvelabs_state": "asset_processing",
                },
            )

        await runner._wait_for_asset(provider_asset_id, timeout_seconds=900.0)
        await db.update_asset_metadata(row_id, {"twelvelabs_state": "asset_ready"})

        if not knowledge_item_id:
            created_item = await runner._create_item(
                provider_asset_id,
                metadata={
                    "batch_id": BATCH_ID,
                    "project_id": PROJECT_ID,
                    "ai_film_asset_id": row_id,
                    "source_type": "google_drive",
                    "source_id": source_id,
                    "ingestion_path": "drive_picker_token_direct_upload",
                },
            )
            knowledge_item_id = str(
                created_item.get("_id") or created_item.get("id") or ""
            )
            if not knowledge_item_id:
                raise TwelveLabsError("TwelveLabs knowledge-store item creation returned no id")
            await db.update_asset_metadata(
                row_id,
                {
                    "twelvelabs_item_id": knowledge_item_id,
                    "twelvelabs_state": "indexing",
                },
            )

        await runner._wait_for_item(knowledge_item_id, timeout_seconds=1800.0)
        await db.update_asset_metadata(
            row_id,
            {
                "twelvelabs_asset_id": provider_asset_id,
                "twelvelabs_item_id": knowledge_item_id,
                "twelvelabs_state": "ready",
                "twelvelabs_indexed_at": _now(),
                "twelvelabs_last_error": None,
                "drive_direct_completed_at": _now(),
            },
        )
        return "ready"
    except Exception as exc:
        await db.update_asset_metadata(
            row_id,
            {
                "twelvelabs_state": "failed",
                "twelvelabs_last_error": f"{type(exc).__name__}: {exc}",
                "twelvelabs_failed_at": _now(),
                "drive_direct_failed_at": _now(),
            },
        )
        raise
    finally:
        if temp_path is not None:
            try:
                temp_path.unlink(missing_ok=True)
            except OSError:
                logger.warning("Could not remove temporary AI Films file %s", temp_path)


async def bootstrap_sovereign_signal_drive_direct_fallback(
    environ: Mapping[str, str] | None = None,
) -> dict[str, Any]:
    source = environ or os.environ
    if not should_schedule_sovereign_signal_bootstrap(source):
        return {"status": "skipped", "reason": "not_production_railway"}

    try:
        client = TwelveLabsClient(environ=source)
    except TwelveLabsConfigurationError:
        return {"status": "skipped", "reason": "twelvelabs_not_configured"}

    try:
        db = SupabaseFilmBootstrapClient(environ=source)
    except RuntimeError:
        return {"status": "skipped", "reason": "supabase_not_configured"}

    native_state = await _wait_for_native_drive_attempt(db)
    if native_state == "complete":
        return {"status": "complete", "reason": "native_connector_complete"}
    if native_state == "authorization_required":
        return {"status": "skipped", "reason": "drive_authorization_required"}

    connections = await _list_active_google_drive_connections(client)
    if not connections:
        await db.update_project_metadata(
            {
                "drive_direct_state": "authorization_required",
                "drive_direct_updated_at": _now(),
            }
        )
        return {"status": "authorization_required"}

    connection_id = _connection_id(connections[0])
    manifest = load_manifest(MANIFEST_PATH)
    entries = [
        entry
        for entry in manifest["assets"]
        if entry.get("source_type") == "google_drive"
    ]
    runner = TwelveLabsIngestionRunner(client=client)
    ready = 0
    skipped = 0
    failed = 0

    await db.update_project_metadata(
        {
            "drive_direct_state": "in_progress",
            "drive_direct_connection_id": connection_id,
            "drive_direct_started_at": _now(),
            "drive_direct_last_error": None,
        }
    )

    for entry in entries:
        source_id = str(entry.get("source_id") or "")
        try:
            result = await _index_direct_drive_entry(
                entry,
                connection_id=connection_id,
                client=client,
                db=db,
                runner=runner,
            )
            if result == "already_ready":
                skipped += 1
            else:
                ready += 1
        except Exception as exc:
            failed += 1
            logger.warning(
                "Drive direct fallback failed for %s: %s: %s",
                source_id,
                type(exc).__name__,
                exc,
            )
        await db.update_project_metadata(
            {
                "drive_direct_ready_count": ready,
                "drive_direct_skipped_count": skipped,
                "drive_direct_failed_count": failed,
                "drive_direct_last_source_id": source_id,
                "drive_direct_updated_at": _now(),
            }
        )

    complete = ready + skipped == len(entries) and failed == 0
    await db.update_project_metadata(
        {
            "drive_direct_state": "complete" if complete else "failed",
            "drive_direct_ready_count": ready,
            "drive_direct_skipped_count": skipped,
            "drive_direct_failed_count": failed,
            "drive_direct_updated_at": _now(),
            "twelvelabs_state": (
                "drive_direct_ingestion_complete"
                if complete
                else "drive_direct_ingestion_partial"
            ),
        }
    )
    return {
        "status": "complete" if complete else "partial",
        "ready": ready,
        "skipped": skipped,
        "failed": failed,
    }
