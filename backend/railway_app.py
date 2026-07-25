"""Railway entry point for the canonical D3VONN.IO FastAPI application.

This wrapper keeps the production app defined in ``backend.main`` while adding
non-sensitive deployment diagnostics that prove which image and router surface
are active behind ``api.d3vonn.io``.
"""
from __future__ import annotations

from backend.main import app

DEPLOYMENT_REVISION = "railway-canonical-router-2026-07-24"


@app.get("/health/deployment", tags=["ops"])
async def deployment_info() -> dict[str, object]:
    paths = {getattr(route, "path", "") for route in app.routes}
    return {
        "status": "ok",
        "revision": DEPLOYMENT_REVISION,
        "entrypoint": "backend.railway_app:app",
        "route_count": len(paths),
        "routers": {
            "proxy": "/api/deploy/probe" in paths,
            "api_v1": "/api/v1/health" in paths,
            "operations": "/api/v1/ops/health" in paths,
            "intelligence": "/api/intelligence/prompts" in paths,
            "occ": "/api/occ/stats" in paths,
            "admin": "/api/admin/overview" in paths,
        },
    }
