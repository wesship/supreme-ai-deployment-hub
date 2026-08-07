"""Railway entry point for the canonical D3VONN.IO FastAPI application.

This wrapper keeps the production app defined in ``backend.main`` while adding
non-sensitive deployment diagnostics that prove which image and router surface
are active behind the Railway service hostname.
"""
from __future__ import annotations

import asyncio
import logging
import os
from contextlib import asynccontextmanager, suppress
from importlib import import_module

from fastapi.middleware.cors import CORSMiddleware

from backend.cors_config import build_allowed_origins

# Railway provides the authoritative environment name to every deployment.
# Normalize the generic application variable before importing backend.main so
# readiness payloads, Sentry, and logs cannot mislabel staging as production.
if railway_environment := os.getenv("RAILWAY_ENVIRONMENT_NAME", "").strip():
    os.environ["ENVIRONMENT"] = railway_environment

app = import_module("backend.main").app
logger = logging.getLogger(__name__)

# Extend—rather than replace—the canonical FastAPI lifespan. The background
# bootstraps run only on the production Railway environment and become no-ops
# after their respective project phases are marked complete in Supabase.
_base_lifespan = app.router.lifespan_context


@asynccontextmanager
async def railway_lifespan(app_instance):
    bootstrap_task: asyncio.Task | None = None
    drive_bootstrap_task: asyncio.Task | None = None
    async with _base_lifespan(app_instance):
        try:
            from backend.ai_films.bootstrap import (
                bootstrap_sovereign_signal_movieflow_ingestion,
                should_schedule_sovereign_signal_bootstrap,
            )
            from backend.ai_films.drive_connector import (
                bootstrap_sovereign_signal_drive_ingestion,
            )

            if should_schedule_sovereign_signal_bootstrap():
                bootstrap_task = asyncio.create_task(
                    bootstrap_sovereign_signal_movieflow_ingestion(),
                    name="sovereign-signal-movieflow-ingestion",
                )
                drive_bootstrap_task = asyncio.create_task(
                    bootstrap_sovereign_signal_drive_ingestion(),
                    name="sovereign-signal-drive-ingestion",
                )
                app_instance.state.sovereign_signal_ingestion_task = bootstrap_task
                app_instance.state.sovereign_signal_drive_ingestion_task = drive_bootstrap_task
                logger.info("Scheduled The Sovereign Signal MovieFlow ingestion bootstrap.")
                logger.info("Scheduled The Sovereign Signal Google Drive connector bootstrap.")
        except Exception as exc:  # pragma: no cover - production bootstrap guard
            logger.warning(
                "Could not schedule The Sovereign Signal ingestion bootstrap: %s: %s",
                type(exc).__name__,
                exc,
            )

        try:
            yield
        finally:
            for task in (bootstrap_task, drive_bootstrap_task):
                if task is not None and not task.done():
                    task.cancel()
                    with suppress(asyncio.CancelledError):
                        await task


app.router.lifespan_context = railway_lifespan

DEPLOYMENT_REVISION = "railway-environment-metadata-2026-07-29"
INTELLIGENCE_IMPORT_ERROR: str | None = None
RAILWAY_ALLOWED_ORIGINS = build_allowed_origins(os.getenv("ALLOWED_ORIGINS"))

# Railway may provide ALLOWED_ORIGINS for preview or internal clients. Mount an
# outer production CORS boundary so those values extend—rather than replace—the
# three official D3VONN.IO browser origins configured in backend.cors_config.
app.add_middleware(
    CORSMiddleware,
    allow_origins=RAILWAY_ALLOWED_ORIGINS,
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allow_headers=["Authorization", "Content-Type", "X-Requested-With", "X-Request-ID"],
)


def _paths() -> set[str]:
    return {getattr(route, "path", "") for route in app.routes}


# The canonical app defensively skips optional routers on ImportError. Retry the
# intelligence router here so Railway either mounts it or exposes a safe,
# actionable diagnostic instead of silently serving a partial API surface.
if "/api/intelligence/prompts" not in _paths():
    try:
        from backend.intelligence.api_router import router as intelligence_router

        app.include_router(intelligence_router, prefix="/api", tags=["intelligence"])
    except Exception as exc:  # pragma: no cover - production diagnostic guard
        INTELLIGENCE_IMPORT_ERROR = f"{type(exc).__name__}: {exc}"


@app.get("/health/deployment", tags=["ops"])
async def deployment_info() -> dict[str, object]:
    paths = _paths()
    return {
        "status": "ok",
        "revision": DEPLOYMENT_REVISION,
        "entrypoint": "backend.railway_app:app",
        "environment": os.getenv("ENVIRONMENT", "unknown"),
        "railway_environment": os.getenv("RAILWAY_ENVIRONMENT_NAME", "unknown"),
        "railway_deployment_id": os.getenv("RAILWAY_DEPLOYMENT_ID"),
        "railway_git_commit_sha": os.getenv("RAILWAY_GIT_COMMIT_SHA"),
        "route_count": len(paths),
        "routers": {
            "api_health": "/api/health" in paths,
            "proxy": "/api/deploy/probe" in paths,
            "api_v1": "/api/v1/health" in paths,
            "operations": "/api/v1/ops/health" in paths,
            "intelligence": "/api/intelligence/prompts" in paths,
            "occ": "/api/occ/stats" in paths,
            "admin": "/api/admin/overview" in paths,
        },
        "intelligence_import_error": INTELLIGENCE_IMPORT_ERROR,
        "official_cors_origins": [
            origin for origin in RAILWAY_ALLOWED_ORIGINS if origin.endswith("d3vonn.io")
        ],
    }
