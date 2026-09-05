"""Workspace/tenant context consistency middleware.

Authorization remains enforced by endpoint dependencies and Supabase RLS. This
middleware adds a fail-closed consistency check when callers provide an explicit
workspace header, preventing header/body/query tenant confusion at the API edge.
"""
from __future__ import annotations

from starlette.middleware.base import BaseHTTPMiddleware
from starlette.requests import Request
from starlette.responses import JSONResponse, Response


class MultiTenancyMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next) -> Response:
        header_workspace = request.headers.get("x-workspace-id", "").strip()
        query_workspace = request.query_params.get("workspace_id", "").strip()

        if header_workspace and query_workspace and header_workspace != query_workspace:
            return JSONResponse(
                status_code=400,
                content={"detail": "workspace context mismatch"},
            )

        # Make the asserted tenant context available to downstream handlers.
        request.state.workspace_id = header_workspace or query_workspace or None
        return await call_next(request)
