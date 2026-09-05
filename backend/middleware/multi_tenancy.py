"""Workspace/tenant context consistency middleware.

Authorization remains the responsibility of authenticated route dependencies and
workspace-membership checks. This middleware prevents ambiguous tenant context by
rejecting conflicting or malformed workspace identifiers before handlers run.
"""
from __future__ import annotations

from uuid import UUID

from starlette.middleware.base import BaseHTTPMiddleware
from starlette.requests import Request
from starlette.responses import JSONResponse, Response


def _normalise_workspace_id(value: str) -> str:
    return str(UUID(value.strip()))


class MultiTenancyMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next) -> Response:
        raw_values: list[str] = []

        header_value = request.headers.get("x-workspace-id")
        if header_value:
            raw_values.append(header_value)

        raw_values.extend(request.query_params.getlist("workspace_id"))

        if raw_values:
            try:
                workspace_ids = {_normalise_workspace_id(value) for value in raw_values}
            except (ValueError, AttributeError):
                return JSONResponse(status_code=400, content={"detail": "Invalid workspace_id"})

            if len(workspace_ids) != 1:
                return JSONResponse(status_code=400, content={"detail": "Conflicting workspace context"})

            request.state.workspace_id = next(iter(workspace_ids))
        else:
            request.state.workspace_id = None

        response: Response = await call_next(request)
        return response
