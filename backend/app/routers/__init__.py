"""
Devonn.ai Backend Proxy — Router Registry
Registers all proxy sub-routers under the /api prefix.

This registry is intentionally defensive: one optional router import must not
prevent the rest of the API proxy surface from mounting in production.
"""
from __future__ import annotations

import asyncio
import contextlib
import logging
from contextlib import asynccontextmanager

from fastapi import APIRouter, FastAPI, Request

logger = logging.getLogger(__name__)


@asynccontextmanager
async def proxy_lifespan(_: FastAPI):
    """Run Railway-native voice activation alongside the canonical app lifespan."""
    activation_task: asyncio.Task[None] | None = None
    try:
        from backend.app.voice_activation import activate_voice_runtime

        activation_task = asyncio.create_task(
            activate_voice_runtime(),
            name="d3vonn-voice-activation",
        )
        logger.info("Railway-native voice activation scheduled.")
    except ImportError as exc:
        logger.warning("Railway-native voice activation unavailable: %s", exc)

    yield

    if activation_task and not activation_task.done():
        activation_task.cancel()
        with contextlib.suppress(asyncio.CancelledError):
            await activation_task


proxy_router = APIRouter(prefix="/api", lifespan=proxy_lifespan)


@proxy_router.get("/health", tags=["ops"])
async def api_health_compatibility(request: Request) -> dict[str, str]:
    """Compatibility liveness probe for clients that expect an /api prefix."""
    return {"status": "ok", "version": request.app.version}


@proxy_router.get("/deploy/probe", tags=["ops"])
async def deploy_probe():
    """Production deploy marker used to verify the active Railway image."""
    return {
        "status": "ok",
        "router_registry": "backend.app.routers",
        "deployment_marker": "backend-api-certification-2026-07-24",
        "proxy_vault_expected": "/api/proxy/config",
        "contact_route_expected": "/api/contact",
        "voice_routes_expected": [
            "/api/tools/voice/tts",
            "/api/tools/voice/stt-token",
            "/api/voice/health",
            "/api/voice/vapi/webhook",
        ],
        "compatibility_routes": [
            "/api/api/tools/voice/tts",
            "/api/api/tools/voice/stt-token",
        ],
    }


try:
    from backend.app.routers.chat import router as chat_router

    proxy_router.include_router(chat_router, tags=["chat"])
    logger.info("Chat proxy router registered.")
except ImportError as exc:
    logger.warning("Chat proxy router not registered: %s", exc)

try:
    from backend.app.routers.rag import router as rag_router

    proxy_router.include_router(rag_router, tags=["rag"])
    logger.info("RAG proxy router registered.")
except ImportError as exc:
    logger.warning("RAG proxy router not registered: %s", exc)

try:
    from backend.app.routers.tools import router as tools_router

    proxy_router.include_router(tools_router, tags=["tools"])
    proxy_router.include_router(tools_router, prefix="/api", tags=["tools-compat"])
    logger.info(
        "Tools proxy router registered at /api/tools/* with temporary "
        "/api/api/tools/* compatibility aliases."
    )
except ImportError as exc:
    logger.warning("Tools proxy router not registered: %s", exc)

try:
    from backend.app.routers.voice_orchestration import router as voice_orchestration_router

    proxy_router.include_router(voice_orchestration_router)
    logger.info("Vapi + ElevenLabs + Hermes router registered at /api/voice/*.")
except ImportError as exc:
    logger.warning("Voice orchestration router not registered: %s", exc)

try:
    from backend.app.routers.admin import router as admin_router

    proxy_router.include_router(admin_router, tags=["admin"])
    logger.info("Admin proxy router registered.")
except ImportError as exc:
    logger.warning("Admin proxy router not registered: %s", exc)

try:
    from backend.app.routers.contact import router as contact_router

    proxy_router.include_router(contact_router, tags=["contact"])
    logger.info("Contact delivery router registered at /api/contact.")
except ImportError as exc:
    logger.warning("Contact delivery router not registered: %s", exc)

try:
    from backend.app.routers.proxy_vault import router as proxy_vault_router

    proxy_router.include_router(proxy_vault_router, tags=["proxy-vault"])
    logger.info("Proxy vault router registered at /api/proxy/*.")
except ImportError as exc:
    logger.warning("Proxy vault router not registered: %s", exc)

try:
    from backend.ai_films.router import router as ai_film_router

    proxy_router.include_router(ai_film_router, tags=["ai-films"])
    logger.info("AI Film provider router registered at /api/ai-films/*.")
except ImportError as exc:
    logger.warning("AI Film provider router not registered: %s", exc)

try:
    from backend.ai_films.index_router import router as ai_film_index_router

    proxy_router.include_router(ai_film_index_router, tags=["ai-films-index"])
    logger.info(
        "AI Film TwelveLabs index router registered at "
        "/api/ai-films/intelligence/twelvelabs/index/*."
    )
except ImportError as exc:
    logger.warning("AI Film TwelveLabs index router not registered: %s", exc)

try:
    from backend.ai_films.picker_router import router as ai_film_picker_router

    proxy_router.include_router(ai_film_picker_router, tags=["ai-films-admin"])
    logger.info("AI Film Drive Picker router registered at /api/ai-films/admin/drive-picker/*.")
except ImportError as exc:
    logger.warning("AI Film Drive Picker router not registered: %s", exc)
