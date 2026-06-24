"""
Devonn.ai Backend Proxy — Router Registry
Registers all proxy sub-routers under the /api prefix.
"""
from fastapi import APIRouter

from backend.app.routers.chat import router as chat_router
from backend.app.routers.rag import router as rag_router
from backend.app.routers.tools import router as tools_router
from backend.app.routers.admin import router as admin_router
from backend.app.routers.proxy_vault import router as proxy_vault_router

proxy_router = APIRouter(prefix="/api")

proxy_router.include_router(chat_router, tags=["chat"])
proxy_router.include_router(rag_router, tags=["rag"])
proxy_router.include_router(tools_router, tags=["tools"])
proxy_router.include_router(admin_router, tags=["admin"])
proxy_router.include_router(proxy_vault_router, tags=["proxy-config"])
