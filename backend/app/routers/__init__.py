"""
Devonn.ai Backend Proxy — Router Registry
Registers all proxy sub-routers under the /api prefix.

This registry is intentionally defensive: one optional router import must not
prevent the rest of the API proxy surface from mounting in production.
"""
from __future__ import annotations

import logging

from fastapi import APIRouter

logger = logging.getLogger(__name__)

proxy_router = APIRouter(prefix="/api")


@proxy_router.get("/deploy/probe", tags=["ops"])
async def deploy_probe():
    """Production deploy marker used to verify the active Railway image."""
    return {
        "status": "ok",
        "router_registry": "backend.app.routers",
        "proxy_vault_expected": "/api/proxy/config",
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
    logger.info("Tools proxy router registered.")
except ImportError as exc:
    logger.warning("Tools proxy router not registered: %s", exc)

try:
    from backend.app.routers.admin import router as admin_router

    proxy_router.include_router(admin_router, tags=["admin"])
    logger.info("Admin proxy router registered.")
except ImportError as exc:
    logger.warning("Admin proxy router not registered: %s", exc)

try:
    from backend.app.routers.proxy_vault import router as proxy_vault_router

    proxy_router.include_router(proxy_vault_router, tags=["proxy-vault"])
    logger.info("Proxy vault router registered at /api/proxy/*.")
except ImportError as exc:
    logger.warning("Proxy vault router not registered: %s", exc)
