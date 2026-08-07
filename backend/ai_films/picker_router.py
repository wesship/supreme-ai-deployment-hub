"""Admin-only Google Drive Picker control plane for Sovereign Signal ingestion.

Automatic Railway ingestion stays paused. An administrator explicitly opens the
Google Drive Picker with a short-lived TwelveLabs picker token, records the
selected Drive file IDs, and only then starts the existing resumable ingestion
jobs. The picker token is never stored server-side or in Supabase.
"""

from __future__ import annotations

import asyncio
from typing import Any

from fastapi import APIRouter, Depends, HTTPException, Request, Response, status
from pydantic import BaseModel, Field

from backend.ai_films.bootstrap import (
    PROJECT_ID,
    SupabaseFilmBootstrapClient,
    _now,
    bootstrap_sovereign_signal_movieflow_ingestion,
)
from backend.ai_films.drive_connector import (
    MANIFEST_PATH,
    _connection_id,
    _list_active_google_drive_connections,
    bootstrap_sovereign_signal_drive_ingestion,
)
from backend.ai_films.drive_direct_fallback import (
    bootstrap_sovereign_signal_drive_direct_fallback,
)
from backend.ai_films.ingestion import load_manifest
from backend.ai_films.twelvelabs import (
    TwelveLabsClient,
    TwelveLabsConfigurationError,
    TwelveLabsError,
)
from backend.app.routers.admin import _require_admin

router = APIRouter(prefix="/ai-films/admin/drive-picker", tags=["ai-films-admin"])


class DrivePickerSelectionRequest(BaseModel):
    source_ids: list[str] = Field(..., min_length=1, max_length=100)


def _expected_drive_entries() -> list[dict[str, str]]:
    manifest = load_manifest(MANIFEST_PATH)
    entries: list[dict[str, str]] = []
    for entry in manifest["assets"]:
        if entry.get("source_type") != "google_drive":
            continue
        source_id = str(entry.get("source_id") or "").strip()
        if not source_id:
            continue
        entries.append(
            {
                "source_id": source_id,
                "filename": str(entry.get("source_filename") or f"{source_id}.mp4"),
            }
        )
    return entries


def _selected_ids_for_connection(
    metadata: dict[str, Any],
    connection_id: str,
    expected_ids: set[str],
) -> set[str]:
    """Return Picker selections only when they belong to the active connection."""
    if str(metadata.get("drive_picker_connection_id") or "") != connection_id:
        return set()
    return {
        str(value)
        for value in (metadata.get("drive_picker_selected_ids") or [])
        if str(value) in expected_ids
    }


async def _clients() -> tuple[TwelveLabsClient, SupabaseFilmBootstrapClient]:
    try:
        client = TwelveLabsClient()
    except TwelveLabsConfigurationError as exc:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail=str(exc),
        ) from exc
    try:
        db = SupabaseFilmBootstrapClient()
    except RuntimeError as exc:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="AI Films production database is not configured",
        ) from exc
    return client, db


async def _active_drive_connection(
    client: TwelveLabsClient,
    db: SupabaseFilmBootstrapClient,
) -> dict[str, Any]:
    connections = await _list_active_google_drive_connections(client)
    if not connections:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="No active TwelveLabs Google Drive connection is available",
        )

    project = await db.get_project(PROJECT_ID)
    metadata = dict((project or {}).get("metadata") or {})
    preferred_id = str(
        metadata.get("drive_ingestion_connection_id")
        or metadata.get("drive_direct_connection_id")
        or ""
    )
    if preferred_id:
        for connection in connections:
            if _connection_id(connection) == preferred_id:
                return connection

    if len(connections) == 1:
        return connections[0]

    raise HTTPException(
        status_code=status.HTTP_409_CONFLICT,
        detail="Multiple active Google Drive connections exist; select the production connection first",
    )


@router.get("/session")
async def create_drive_picker_session(
    response: Response,
    _: str = Depends(_require_admin),
) -> dict[str, Any]:
    """Return a one-hour Google Picker credential and the expected Drive masters."""
    response.headers["Cache-Control"] = "private, no-store"
    response.headers["Pragma"] = "no-cache"

    client, db = await _clients()
    connection = await _active_drive_connection(client, db)
    connection_id = _connection_id(connection)
    try:
        token_payload = await client._request(
            "POST", f"/connections/{connection_id}/picker-token"
        )
    except TwelveLabsError as exc:
        raise HTTPException(status_code=502, detail=str(exc)) from exc

    access_token = str(token_payload.get("access_token") or "")
    if not access_token:
        raise HTTPException(status_code=502, detail="TwelveLabs returned no Drive picker token")

    expected_files = _expected_drive_entries()
    expected_ids = {entry["source_id"] for entry in expected_files}
    project = await db.get_project(PROJECT_ID)
    metadata = dict((project or {}).get("metadata") or {})
    previously_selected = _selected_ids_for_connection(
        metadata,
        connection_id,
        expected_ids,
    )
    account = connection.get("account") if isinstance(connection.get("account"), dict) else {}

    return {
        "connection_id": connection_id,
        "account": account.get("display_name"),
        "access_token": access_token,
        "expires_in": token_payload.get("expires_in"),
        "app_id": token_payload.get("app_id"),
        "developer_key": token_payload.get("developer_key"),
        "expected_files": expected_files,
        "expected_count": len(expected_files),
        "selected_ids": sorted(previously_selected),
        "selected_count": len(previously_selected),
        "selection_ready": previously_selected == expected_ids,
    }


@router.post("/selection")
async def record_drive_picker_selection(
    payload: DrivePickerSelectionRequest,
    _: str = Depends(_require_admin),
) -> dict[str, Any]:
    """Accumulate Picker-selected source IDs and persist only the IDs, never tokens."""
    client, db = await _clients()
    connection = await _active_drive_connection(client, db)
    connection_id = _connection_id(connection)

    expected_files = _expected_drive_entries()
    expected_ids = {entry["source_id"] for entry in expected_files}
    supplied_ids = {value.strip() for value in payload.source_ids if value.strip()}
    unknown_ids = sorted(supplied_ids - expected_ids)
    if unknown_ids:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Picker returned files outside the Sovereign Signal batch",
        )

    project = await db.get_project(PROJECT_ID)
    if not project:
        raise HTTPException(status_code=404, detail="Sovereign Signal AI Films project is missing")
    metadata = dict(project.get("metadata") or {})
    previous_ids = _selected_ids_for_connection(
        metadata,
        connection_id,
        expected_ids,
    )
    selected_ids = previous_ids | supplied_ids
    missing_ids = expected_ids - selected_ids
    filenames_by_id = {entry["source_id"]: entry["filename"] for entry in expected_files}

    await db.update_project_metadata(
        {
            "drive_picker_state": "selected" if not missing_ids else "partial",
            "drive_picker_connection_id": connection_id,
            "drive_picker_selected_ids": sorted(selected_ids),
            "drive_picker_selected_count": len(selected_ids),
            "drive_picker_expected_count": len(expected_ids),
            "drive_picker_selected_at": _now() if not missing_ids else None,
            "drive_picker_updated_at": _now(),
        }
    )

    return {
        "status": "selected" if not missing_ids else "partial",
        "selected_count": len(selected_ids),
        "expected_count": len(expected_ids),
        "selection_ready": not missing_ids,
        "missing_files": [filenames_by_id[source_id] for source_id in sorted(missing_ids)],
    }


def _task_running(task: Any) -> bool:
    return isinstance(task, asyncio.Task) and not task.done()


@router.post("/run", status_code=status.HTTP_202_ACCEPTED)
async def run_selected_sovereign_signal_ingestion(
    request: Request,
    _: str = Depends(_require_admin),
) -> dict[str, Any]:
    """Explicitly start paused ingestion only after all expected Drive files were picked."""
    client, db = await _clients()
    connection = await _active_drive_connection(client, db)
    active_connection_id = _connection_id(connection)
    expected_ids = {entry["source_id"] for entry in _expected_drive_entries()}
    project = await db.get_project(PROJECT_ID)
    if not project:
        raise HTTPException(status_code=404, detail="Sovereign Signal AI Films project is missing")
    metadata = dict(project.get("metadata") or {})
    picker_connection_id = str(metadata.get("drive_picker_connection_id") or "")
    if picker_connection_id != active_connection_id:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Drive Picker connection changed; select the 23 masters again",
        )
    selected_ids = _selected_ids_for_connection(
        metadata,
        active_connection_id,
        expected_ids,
    )
    if selected_ids != expected_ids:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"Drive Picker selection is incomplete ({len(selected_ids)}/{len(expected_ids)})",
        )

    existing = getattr(request.app.state, "sovereign_signal_manual_ingestion_tasks", {})
    if isinstance(existing, dict) and any(_task_running(task) for task in existing.values()):
        return {
            "status": "already_running",
            "tasks": sorted(name for name, task in existing.items() if _task_running(task)),
        }

    # Persist the manual run marker before workers can update project metadata.
    await db.update_project_metadata(
        {
            "manual_ingestion_state": "started",
            "manual_ingestion_started_at": _now(),
            "manual_ingestion_trigger": "admin_drive_picker",
            "manual_ingestion_connection_id": active_connection_id,
        }
    )

    movieflow_task = asyncio.create_task(
        bootstrap_sovereign_signal_movieflow_ingestion(),
        name="manual-sovereign-signal-movieflow",
    )
    drive_task = asyncio.create_task(
        bootstrap_sovereign_signal_drive_ingestion(
            preferred_connection_id=active_connection_id,
        ),
        name="manual-sovereign-signal-drive",
    )
    drive_direct_task = asyncio.create_task(
        bootstrap_sovereign_signal_drive_direct_fallback(
            preferred_connection_id=active_connection_id,
        ),
        name="manual-sovereign-signal-drive-direct",
    )
    tasks = {
        "movieflow": movieflow_task,
        "drive": drive_task,
        "drive_direct": drive_direct_task,
    }
    request.app.state.sovereign_signal_manual_ingestion_tasks = tasks
    return {"status": "started", "tasks": sorted(tasks)}