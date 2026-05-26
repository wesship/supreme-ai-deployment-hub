"""
Devonn.ai Backend Proxy — Router Registry
Registers all proxy sub-routers under the /api prefix.
"""
from fastapi import APIRouter

from app.routers.chat import router as chat_router
from app.routers.rag import router as rag_router
from app.routers.tools import router as tools_router

proxy_router = APIRouter(prefix="/api")

proxy_router.include_router(chat_router, tags=["chat"])
proxy_router.include_router(rag_router, tags=["rag"])
proxy_router.include_router(tools_router, tags=["tools"])
