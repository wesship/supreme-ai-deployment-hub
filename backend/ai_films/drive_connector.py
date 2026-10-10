"""Google Drive connector bootstrap for The Sovereign Signal Batch 001.

Runs only inside the production Railway runtime. It reuses TwelveLabs' native
Google Drive data connector so private Drive masters never need public links or
a temporary relay bucket.
"""

from __future__ import annotations

import asyncio
import logging
import os
import time
from pathlib import Path
from typing import Any, Mapping

from backend.ai_films.bootstrap import (
    BATCH_ID,
    PROJECT_ID,
    SupabaseFilmBootstrapClient,
    _now,
    should_schedule_sovereign_signal_bootstrap,
)
from backend.ai_films.ingestion import TwelveLabsIngestionRunner, load_manifest
from backend.ai_films.twelvelabs import (
    TwelveLabsClient,
    TwelveLabsConfigurationError,
    TwelveLabsError,
)

logger = logging.getLogger(__name__)
MANIFEST_PATH = Path(__file__).resolve().parent / "manifests" / "sovereign_signal_batch_001.json"


def _connection_id(connection: Mapping[str, Any]) -> str:
    return str(connection.get("_id") or connection.get("id") or "")


async def _list_active_google_drive_connections(client: TwelveLabsClient) -> list[dict[str, Any]]:
    payload = await client._request("GET", "/connections?page=1&page_limit=50")
    rows = payload.get("data")
    if not isinstance(rows, list):
        return []
    return [
        row
        for row in rows
        if isinstance(row, dict)
        and str(row.get("provider") or "").lower() == "google_drive"
        and str(row.get("status") or "").lower() == "active"
        and _connection_id(row)
    ]


async def _import_drive_files(
    client: TwelveLabsClient,
    connection_id: str,
    source_ids: list[str],
) -> dict[str, Any]:
    if not source_ids:
        raise ValueError("No Google Drive source IDs were supplied")
    if len(source_ids) > 100:
        raise ValueError("TwelveLabs accepts at most 100 Drive files per import")
    return await client._request(
        "POST",
        f"/connections/{connection_id}/imports",
        payload={"items": [{"source_id": source_id} for source_id in source_ids]},
    )


async def _wait_for_import(
    client: TwelveLabsClient,
    connection_id: str,
    import_id: str,
    *,
    timeout_seconds: float = 1800.0,
    poll_interval_seconds: float = 5.0,
) -> dict[str, Any]:
    deadline = time.monotonic() + timeout_seconds
    while True:
        result = await client._request(
            "GET", f"/connections/{connection_id}/imports/{import_id}"
        )
        items = result.get("items")
        if isinstance(items, list) and items:
            statuses = {
                str(item.get("status") or "").lower()
                for item in items
                if isinstance(item, dict) and item.get("status")
            }
            unresolved = statuses - {"ready", "failed"}
            if not unresolved:
                return result
        if time.monotonic() >= deadline:
            raise TwelveLabsError(f"TwelveLabs Drive import {import_id} did not finish in time")
        await asyncio.sleep(poll_interval_seconds)


async def bootstrap_sovereign_signal_drive_ingestion(
    environ: Mapping[str, str] | None = None,
    *,
    preferred_connection_id: str | None = None,
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

    project = await db.get_project(PROJECT_ID)
    if not project:
        return {"status": "skipped", "reason": "project_missing"}
    project_metadata = dict(project.get("metadata") or {})
    if project_metadata.get("drive_ingestion_state") == "complete":
        return {"status": "complete", "reason": "already_complete"}

    connections = await _list_active_google_drive_connections(client)
    if not connections:
        await db.update_project_metadata(
            {
                "drive_ingestion_state": "authorization_required",
                "drive_ingestion_updated_at": _now(),
                "drive_ingestion_last_error": None,
            }
        )
        return {"status": "authorization_required", "active_connections": 0}

    if preferred_connection_id:
        connection = next(
            (
                candidate
                for candidate in connections
                if _connection_id(candidate) == preferred_connection_id
            ),
            None,
        )
        if connection is None:
            await db.update_project_metadata(
                {
                    "drive_ingestion_state": "authorization_required",
                    "drive_ingestion_updated_at": _now(),
                    "drive_ingestion_last_error": "picker_connection_not_active",
                }
            )
            return {
                "status": "authorization_required",
                "reason": "picker_connection_not_active",
            }
    else:
        connection = connections[0]

    connection_id = _connection_id(connection)
    account = connection.get("account") if isinstance(connection.get("account"), dict) else {}
    await db.update_project_metadata(
        {
            "drive_ingestion_state": "importing",
            "drive_ingestion_connection_id": connection_id,
            "drive_ingestion_account": account.get("display_name"),
            "drive_ingestion_started_at": _now(),
            "drive_ingestion_last_error": None,
        }
    )

    manifest = load_manifest(MANIFEST_PATH)
    entries = [entry for entry in manifest["assets"] if entry.get("source_type") == "google_drive"]
    source_ids = [str(entry.get("source_id") or "") for entry in entries if entry.get("source_id")]
    import_result = await _import_drive_files(client, connection_id, source_ids)
    import_id = str(import_result.get("_id") or import_result.get("id") or "")
    if not import_id:
        raise TwelveLabsError("TwelveLabs Drive import returned no import id")

    await db.update_project_metadata(
        {
            "drive_ingestion_import_id": import_id,
            "drive_ingestion_state": "processing",
            "drive_ingestion_updated_at": _now(),
        }
    )
    completed_import = await _wait_for_import(client, connection_id, import_id)
    import_items = completed_import.get("items") if isinstance(completed_import.get("items"), list) else []
    items_by_source = {
        str(item.get("source_id")): item
        for item in import_items
        if isinstance(item, dict) and item.get("source_id")
    }

    runner = TwelveLabsIngestionRunner(client=client)
    ready_count = 0
    failed_count = 0

    for entry in entries:
        source_id = str(entry.get("source_id") or "")
        row = await db.get_asset(source_type="google_drive", source_id=source_id)
        if not row:
            failed_count += 1
            continue
        asset_row_id = str(row["id"])
        item = items_by_source.get(source_id, {})
        status = str(item.get("status") or "").lower()
        provider_asset_id = str(item.get("asset_id") or "")
        if status != "ready" or not provider_asset_id:
            failed_count += 1
            error = item.get("error") if isinstance(item.get("error"), dict) else {}
            await db.update_asset_metadata(
                asset_row_id,
                {
                    "twelvelabs_state": "failed",
                    "twelvelabs_last_error": str(error.get("code") or status or "drive_import_failed"),
                    "twelvelabs_failed_at": _now(),
                    "twelvelabs_drive_import_id": import_id,
                },
            )
            continue

        current_metadata = dict(row.get("metadata") or {})
        knowledge_item_id = str(current_metadata.get("twelvelabs_item_id") or "")
        if not knowledge_item_id:
            knowledge_item = await runner._create_item(
                provider_asset_id,
                metadata={
                    "batch_id": BATCH_ID,
                    "project_id": PROJECT_ID,
                    "ai_film_asset_id": asset_row_id,
                    "source_type": "google_drive",
                    "source_id": source_id,
                },
            )
            knowledge_item_id = str(knowledge_item.get("_id") or knowledge_item.get("id") or "")
            if not knowledge_item_id:
                failed_count += 1
                await db.update_asset_metadata(
                    asset_row_id,
                    {
                        "twelvelabs_asset_id": provider_asset_id,
                        "twelvelabs_state": "failed",
                        "twelvelabs_last_error": "knowledge_store_item_creation_returned_no_id",
                        "twelvelabs_failed_at": _now(),
                    },
                )
                continue

        await db.update_asset_metadata(
            asset_row_id,
            {
                "twelvelabs_asset_id": provider_asset_id,
                "twelvelabs_item_id": knowledge_item_id,
                "twelvelabs_state": "indexing",
                "twelvelabs_drive_import_id": import_id,
                "twelvelabs_last_error": None,
            },
        )
        try:
            await runner._wait_for_item(knowledge_item_id)
        except Exception as exc:
            failed_count += 1
            await db.update_asset_metadata(
                asset_row_id,
                {
                    "twelvelabs_state": "failed",
                    "twelvelabs_last_error": f"{type(exc).__name__}: {exc}",
                    "twelvelabs_failed_at": _now(),
                },
            )
            continue

        ready_count += 1
        await db.update_asset_metadata(
            asset_row_id,
            {
                "twelvelabs_state": "ready",
                "twelvelabs_indexed_at": _now(),
                "twelvelabs_last_error": None,
            },
        )

    complete = ready_count == len(entries) and failed_count == 0
    await db.update_project_metadata(
        {
            "drive_ingestion_state": "complete" if complete else "failed",
            "drive_ingestion_ready_count": ready_count,
            "drive_ingestion_failed_count": failed_count,
            "drive_ingestion_updated_at": _now(),
            "twelvelabs_state": "drive_ingestion_complete" if complete else "drive_ingestion_partial",
        }
    )
    return {
        "status": "complete" if complete else "partial",
        "connection_id": connection_id,
        "import_id": import_id,
        "ready": ready_count,
        "failed": failed_count,
    }
