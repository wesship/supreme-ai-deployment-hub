"""
API v2 Router for D3VONN
Introduces streaming responses and GraphQL-like sparse fieldsets.
"""

from fastapi import APIRouter, Depends
from auth.jwt import verify_jwt

router = APIRouter(prefix="/api/v2", tags=["v2"])

@router.get("/health")
async def health_v2():
    return {"status": "ok", "version": "v2", "streaming_supported": True}

@router.post("/tasks/stream", dependencies=[Depends(verify_jwt)])
async def stream_task():
    # Placeholder for v2 streaming task endpoint
    return {"error": "Not implemented yet"}
