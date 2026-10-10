"""
backend/middleware/request_context.py — Request ID / correlation ID middleware.

Generates a unique request_id for every incoming HTTP request and stores it
in a contextvars.ContextVar so any code in the call stack can retrieve it
without passing it explicitly.

The request_id is:
  - Taken from the incoming X-Request-ID header if present (for upstream tracing)
  - Otherwise generated as a UUID4
  - Attached to the response as X-Request-ID

Usage:
    from backend.middleware.request_context import get_request_id

    request_id = get_request_id()  # works anywhere in the same async task

Registration in main.py:
    from backend.middleware.request_context import RequestContextMiddleware
    app.add_middleware(RequestContextMiddleware)
"""
from __future__ import annotations

import uuid
from contextvars import ContextVar

from starlette.middleware.base import BaseHTTPMiddleware
from starlette.requests import Request
from starlette.responses import Response

# ---------------------------------------------------------------------------
# Context variable — stores the current request's ID
# ---------------------------------------------------------------------------
_request_id_var: ContextVar[str] = ContextVar("request_id", default="")


def get_request_id() -> str:
    """Return the request ID for the current async context. Empty string if not set."""
    return _request_id_var.get()


# ---------------------------------------------------------------------------
# Middleware
# ---------------------------------------------------------------------------
class RequestContextMiddleware(BaseHTTPMiddleware):
    """
    Starlette/FastAPI middleware that:
    1. Reads X-Request-ID from the incoming request (if present)
    2. Generates a UUID4 if no header is provided
    3. Stores the ID in a ContextVar for the duration of the request
    4. Adds X-Request-ID to the response headers
    """

    async def dispatch(self, request: Request, call_next) -> Response:
        request_id = (
            request.headers.get("X-Request-ID")
            or request.headers.get("X-Correlation-ID")
            or str(uuid.uuid4())
        )

        token = _request_id_var.set(request_id)
        try:
            response: Response = await call_next(request)
        finally:
            _request_id_var.reset(token)

        response.headers["X-Request-ID"] = request_id
        return response
