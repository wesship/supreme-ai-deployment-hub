"""Admin-only MovieFlow ingestion retry for AI Films certification.

MovieFlow URL ingestion is independent of Google Drive Picker selection. This
router allows an administrator to retry the already-registered Sovereign Signal
MovieFlow renders without weakening the Drive Picker gate for Drive masters.
"""
from __future__ import annotations

import asyncio
from typing import Any

from fastapi import APIRouter, Depends, Request, status

from backend.ai_films.bootstrap import (
    SupabaseFilmBootstrapClient,
    _now,
    bootstrap_sovereign_signal_movieflow_ingestion,
)
from backend.app.routers.admin import _require_admin

router = APIRouter(prefix="/ai-films/admin/movieflow", tags=["ai-films-admin"])


def _task_running(task: Any) -> bool:
    return isinstance(task, asyncio.Task) and not task.done()


@router.post("/retry", status_code=status.HTTP_202_ACCEPTED)
async def retry_sovereign_signal_movieflow_ingestion(
    request: Request,
    _: str = Depends(_require_admin),
) -> dict[str, Any]:
    """Retry MovieFlow → TwelveLabs ingestion without requiring Drive selection."""
    existing = getattr(request.app.state, "sovereign_signal_movieflow_retry_task", None)
    if _task_running(existing):
        return {"status": "already_running", "task": existing.get_name()}

    db = SupabaseFilmBootstrapClient()
    await db.update_project_metadata(
        {
            "movieflow_manual_retry_state": "started",
            "movieflow_manual_retry_started_at": _now(),
            "movieflow_manual_retry_trigger": "admin_movieflow_retry",
        }
    )

    task = asyncio.create_task(
        bootstrap_sovereign_signal_movieflow_ingestion(),
        name="manual-sovereign-signal-movieflow-retry",
    )
    request.app.state.sovereign_signal_movieflow_retry_task = task
    return {"status": "started", "task": task.get_name()}
