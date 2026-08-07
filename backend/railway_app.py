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

if railway_environment := os.getenv("RAILWAY_ENVIRONMENT_NAME", "").strip():
    os.environ["ENVIRONMENT"] = railway_environment

app = import_module("backend.main").app
logger = logging.getLogger(__name__)
_base_lifespan = app.router.lifespan_context


def _sovereign_signal_bootstrap_enabled() -> bool:
    """Require an explicit opt-in after Drive Picker selection is completed."""
    value = os.getenv("AI_FILM_ENABLE_SOVEREIGN_SIGNAL_BOOTSTRAP", "").strip().lower()
    return value in {"1", "true", "yes", "on"}


def _task_state(app_instance, name: str) -> str:
    task = getattr(app_instance.state, name, None)
    if task is None:
        return "not_scheduled"
    if task.cancelled():
        return "cancelled"
    if task.done():
        return "stopped"
    return "running"


@asynccontextmanager
async def railway_lifespan(app_instance):
    bootstrap_task: asyncio.Task | None = None
    drive_bootstrap_task: asyncio.Task | None = None
    drive_direct_task: asyncio.Task | None = None
    jockey_canary_task: asyncio.Task | None = None
    assembly_worker_task: asyncio.Task | None = None
    assembly_qa_task: asyncio.Task | None = None
    async with _base_lifespan(app_instance):
        try:
            from backend.ai_films.jockey_startup_canary import (
                certify_jockey_on_startup,
                should_run_jockey_startup_canary,
            )

            if should_run_jockey_startup_canary():
                jockey_canary_task = asyncio.create_task(
                    certify_jockey_on_startup(),
                    name="ai-films-jockey-production-canary",
                )
                app_instance.state.jockey_production_canary_task = jockey_canary_task
                logger.info("Scheduled one-time TwelveLabs/Jockey production certification.")
        except Exception as exc:  # pragma: no cover - production certification guard
            logger.warning(
                "Could not schedule Jockey production certification: %s: %s",
                type(exc).__name__,
                exc,
            )

        try:
            from backend.ai_films.assembly_worker import run_assembly_worker
            from backend.ai_films.assembly_qa_worker import run_assembly_qa_worker

            assembly_worker_task = asyncio.create_task(
                run_assembly_worker(),
                name="ai-films-ffmpeg-assembly-worker",
            )
            assembly_qa_task = asyncio.create_task(
                run_assembly_qa_worker(),
                name="ai-films-post-render-qa-worker",
            )
            app_instance.state.ai_films_assembly_worker_task = assembly_worker_task
            app_instance.state.ai_films_assembly_qa_task = assembly_qa_task
            logger.info("Scheduled AI Films FFmpeg assembly worker.")
            logger.info("Scheduled AI Films TwelveLabs post-render QA worker.")
        except Exception as exc:  # pragma: no cover - production worker guard
            logger.warning(
                "Could not schedule AI Films assembly workers: %s: %s",
                type(exc).__name__,
                exc,
            )

        try:
            from backend.ai_films.bootstrap import (
                bootstrap_sovereign_signal_movieflow_ingestion,
                should_schedule_sovereign_signal_bootstrap,
            )
            from backend.ai_films.drive_connector import (
                bootstrap_sovereign_signal_drive_ingestion,
            )
            from backend.ai_films.drive_direct_fallback import (
                bootstrap_sovereign_signal_drive_direct_fallback,
            )

            if should_schedule_sovereign_signal_bootstrap() and _sovereign_signal_bootstrap_enabled():
                bootstrap_task = asyncio.create_task(
                    bootstrap_sovereign_signal_movieflow_ingestion(),
                    name="sovereign-signal-movieflow-ingestion",
                )
                drive_bootstrap_task = asyncio.create_task(
                    bootstrap_sovereign_signal_drive_ingestion(),
                    name="sovereign-signal-drive-ingestion",
                )
                drive_direct_task = asyncio.create_task(
                    bootstrap_sovereign_signal_drive_direct_fallback(),
                    name="sovereign-signal-drive-direct-fallback",
                )
                app_instance.state.sovereign_signal_ingestion_task = bootstrap_task
                app_instance.state.sovereign_signal_drive_ingestion_task = drive_bootstrap_task
                app_instance.state.sovereign_signal_drive_direct_task = drive_direct_task
                logger.info("Scheduled The Sovereign Signal MovieFlow ingestion bootstrap.")
                logger.info("Scheduled The Sovereign Signal Google Drive connector bootstrap.")
                logger.info("Scheduled The Sovereign Signal Google Drive direct fallback.")
            elif should_schedule_sovereign_signal_bootstrap():
                logger.info(
                    "The Sovereign Signal ingestion bootstraps are paused until "
                    "AI_FILM_ENABLE_SOVEREIGN_SIGNAL_BOOTSTRAP=true after Drive Picker selection."
                )
        except Exception as exc:  # pragma: no cover - production bootstrap guard
            logger.warning(
                "Could not schedule The Sovereign Signal ingestion bootstrap: %s: %s",
                type(exc).__name__,
                exc,
            )

        try:
            yield
        finally:
            for task in (
                bootstrap_task,
                drive_bootstrap_task,
                drive_direct_task,
                jockey_canary_task,
                assembly_worker_task,
                assembly_qa_task,
            ):
                if task is not None and not task.done():
                    task.cancel()
                    with suppress(asyncio.CancelledError):
                        await task


app.router.lifespan_context = railway_lifespan

DEPLOYMENT_REVISION = "railway-ai-films-assembly-and-qa-worker-2026-08-07"
INTELLIGENCE_IMPORT_ERROR: str | None = None
RAILWAY_ALLOWED_ORIGINS = build_allowed_origins(os.getenv("ALLOWED_ORIGINS"))

app.add_middleware(
    CORSMiddleware,
    allow_origins=RAILWAY_ALLOWED_ORIGINS,
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allow_headers=["Authorization", "Content-Type", "X-Requested-With", "X-Request-ID"],
)


def _paths() -> set[str]:
    return {getattr(route, "path", "") for route in app.routes}


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
        "workers": {
            "ai_films_assembly": _task_state(app, "ai_films_assembly_worker_task"),
            "ai_films_post_render_qa": _task_state(app, "ai_films_assembly_qa_task"),
        },
        "routers": {
            "api_health": "/api/health" in paths,
            "proxy": "/api/deploy/probe" in paths,
            "api_v1": "/api/v1/health" in paths,
            "operations": "/api/v1/ops/health" in paths,
            "intelligence": "/api/intelligence/prompts" in paths,
            "occ": "/api/occ/stats" in paths,
            "admin": "/api/admin/overview" in paths,
            "ai_films_director": "/api/ai-films/director/assemble" in paths,
        },
        "intelligence_import_error": INTELLIGENCE_IMPORT_ERROR,
        "official_cors_origins": [
            origin for origin in RAILWAY_ALLOWED_ORIGINS if origin.endswith("d3vonn.io")
        ],
    }
