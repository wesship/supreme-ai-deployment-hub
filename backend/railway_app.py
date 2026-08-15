"""Railway entry point for the canonical D3VONN.IO FastAPI application."""
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


async def _run_manifest_review_after_conform(conform_task: asyncio.Task | None = None):
    if conform_task is not None:
        with suppress(Exception):
            await conform_task
    from backend.ai_films.manifest_conform_review import review_active_manifest_on_startup
    return await review_active_manifest_on_startup()


async def _run_generation_dispatch_after_review(review_task: asyncio.Task | None = None):
    if review_task is not None:
        with suppress(Exception):
            await review_task
    from backend.ai_films.generation_dispatch_startup import plan_generation_on_startup
    return await plan_generation_on_startup()


@asynccontextmanager
async def railway_lifespan(app_instance):
    bootstrap_task = drive_bootstrap_task = drive_direct_task = None
    jockey_canary_task = assembly_worker_task = assembly_qa_task = None
    manifest_conform_task = manifest_review_task = generation_dispatch_task = None
    openai_video_worker_task = generated_shot_qa_task = anchor_candidate_task = None
    commerce_handoff_task = None
    async with _base_lifespan(app_instance):
        try:
            from backend.ai_films.jockey_startup_canary import certify_jockey_on_startup, should_run_jockey_startup_canary
            if should_run_jockey_startup_canary():
                jockey_canary_task = asyncio.create_task(certify_jockey_on_startup(), name="ai-films-jockey-production-canary")
                app_instance.state.jockey_production_canary_task = jockey_canary_task
                logger.info("Scheduled one-time TwelveLabs/Jockey production certification.")
        except Exception as exc:
            logger.warning("Could not schedule Jockey production certification: %s: %s", type(exc).__name__, exc)

        try:
            from backend.ai_films.manifest_conform import conform_active_manifest_on_startup
            manifest_conform_task = asyncio.create_task(conform_active_manifest_on_startup(), name="ai-films-manifest-conform")
            app_instance.state.ai_films_manifest_conform_task = manifest_conform_task
            manifest_review_task = asyncio.create_task(_run_manifest_review_after_conform(manifest_conform_task), name="ai-films-manifest-jockey-review")
            app_instance.state.ai_films_manifest_review_task = manifest_review_task
            generation_dispatch_task = asyncio.create_task(_run_generation_dispatch_after_review(manifest_review_task), name="ai-films-generation-dispatch")
            app_instance.state.ai_films_generation_dispatch_task = generation_dispatch_task
            logger.info("Scheduled AI Films conform → Jockey review → generation dispatch chain.")
        except Exception as exc:
            logger.warning("Could not schedule AI Films manifest intelligence chain: %s: %s", type(exc).__name__, exc)

        try:
            from backend.ai_films.anchor_frames import extract_anchor_candidates_on_startup
            anchor_candidate_task = asyncio.create_task(extract_anchor_candidates_on_startup(), name="ai-films-anchor-candidates")
            app_instance.state.ai_films_anchor_candidate_task = anchor_candidate_task
            logger.info("Scheduled one-time AI Films anchor-frame candidate extraction.")
        except Exception as exc:
            logger.warning("Could not schedule AI Films anchor candidate extraction: %s: %s", type(exc).__name__, exc)

        try:
            from backend.ai_films.openai_video_worker import run_openai_video_worker
            from backend.ai_films.generated_shot_qa_worker import run_generated_shot_qa_worker
            openai_video_worker_task = asyncio.create_task(run_openai_video_worker(), name="ai-films-openai-video-worker")
            generated_shot_qa_task = asyncio.create_task(run_generated_shot_qa_worker(), name="ai-films-generated-shot-qa-worker")
            app_instance.state.ai_films_openai_video_worker_task = openai_video_worker_task
            app_instance.state.ai_films_generated_shot_qa_task = generated_shot_qa_task
            logger.info("Scheduled gated AI Films OpenAI video and generated-shot QA workers.")
        except Exception as exc:
            logger.warning("Could not schedule AI Films generation workers: %s: %s", type(exc).__name__, exc)

        try:
            from backend.ai_films.commerce_handoff_worker import run_commerce_handoff_worker
            commerce_handoff_task = asyncio.create_task(
                run_commerce_handoff_worker(),
                name="ai-films-pollo-commerce-handoff",
            )
            app_instance.state.ai_films_commerce_handoff_task = commerce_handoff_task
            logger.info("Scheduled durable Pollo to TwelveLabs/Jockey commerce handoff.")
        except Exception as exc:
            logger.warning(
                "Could not schedule AI Films commerce handoff worker: %s: %s",
                type(exc).__name__,
                exc,
            )

        try:
            from backend.ai_films.assembly_worker import run_assembly_worker
            from backend.ai_films.assembly_qa_worker import run_assembly_qa_worker
            assembly_worker_task = asyncio.create_task(run_assembly_worker(), name="ai-films-ffmpeg-assembly-worker")
            assembly_qa_task = asyncio.create_task(run_assembly_qa_worker(), name="ai-films-post-render-qa-worker")
            app_instance.state.ai_films_assembly_worker_task = assembly_worker_task
            app_instance.state.ai_films_assembly_qa_task = assembly_qa_task
            logger.info("Scheduled AI Films assembly and post-render QA workers.")
        except Exception as exc:
            logger.warning("Could not schedule AI Films assembly workers: %s: %s", type(exc).__name__, exc)

        try:
            from backend.ai_films.bootstrap import bootstrap_sovereign_signal_movieflow_ingestion, should_schedule_sovereign_signal_bootstrap
            from backend.ai_films.drive_connector import bootstrap_sovereign_signal_drive_ingestion
            from backend.ai_films.drive_direct_fallback import bootstrap_sovereign_signal_drive_direct_fallback
            if should_schedule_sovereign_signal_bootstrap() and _sovereign_signal_bootstrap_enabled():
                bootstrap_task = asyncio.create_task(bootstrap_sovereign_signal_movieflow_ingestion(), name="sovereign-signal-movieflow-ingestion")
                drive_bootstrap_task = asyncio.create_task(bootstrap_sovereign_signal_drive_ingestion(), name="sovereign-signal-drive-ingestion")
                drive_direct_task = asyncio.create_task(bootstrap_sovereign_signal_drive_direct_fallback(), name="sovereign-signal-drive-direct-fallback")
                app_instance.state.sovereign_signal_ingestion_task = bootstrap_task
                app_instance.state.sovereign_signal_drive_ingestion_task = drive_bootstrap_task
                app_instance.state.sovereign_signal_drive_direct_task = drive_direct_task
            elif should_schedule_sovereign_signal_bootstrap():
                logger.info("The Sovereign Signal ingestion bootstraps remain paused pending explicit enablement.")
        except Exception as exc:
            logger.warning("Could not schedule Sovereign Signal ingestion bootstrap: %s: %s", type(exc).__name__, exc)

        try:
            yield
        finally:
            for task in (bootstrap_task, drive_bootstrap_task, drive_direct_task, jockey_canary_task, manifest_conform_task, manifest_review_task, generation_dispatch_task, anchor_candidate_task, openai_video_worker_task, generated_shot_qa_task, commerce_handoff_task, assembly_worker_task, assembly_qa_task):
                if task is not None and not task.done():
                    task.cancel()
                    with suppress(asyncio.CancelledError):
                        await task


app.router.lifespan_context = railway_lifespan

DEPLOYMENT_REVISION = "railway-ai-films-pollo-commerce-handoff-2026-08-10"
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
    except Exception as exc:
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
            "ai_films_manifest_conform": _task_state(app, "ai_films_manifest_conform_task"),
            "ai_films_manifest_review": _task_state(app, "ai_films_manifest_review_task"),
            "ai_films_generation_dispatch": _task_state(app, "ai_films_generation_dispatch_task"),
            "ai_films_anchor_candidates": _task_state(app, "ai_films_anchor_candidate_task"),
            "ai_films_openai_video": _task_state(app, "ai_films_openai_video_worker_task"),
            "ai_films_generated_shot_qa": _task_state(app, "ai_films_generated_shot_qa_task"),
            "ai_films_commerce_handoff": _task_state(app, "ai_films_commerce_handoff_task"),
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
            "ai_films_production_bible": "/api/ai-films/production/bible/{project_id}" in paths,
            "ai_films_anchor_frames": "/api/ai-films/production/anchors/candidates" in paths,
            "ai_films_commerce_dispatch": "/api/ai-films/commerce/providers/pollo/dispatch" in paths,
            "ai_films_commerce_webhook": "/api/ai-films/commerce/providers/pollo/webhook" in paths,
        },
        "intelligence_import_error": INTELLIGENCE_IMPORT_ERROR,
        "official_cors_origins": [origin for origin in RAILWAY_ALLOWED_ORIGINS if origin.endswith("d3vonn.io")],
    }
