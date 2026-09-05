"""Security-conscious HTTP request logging middleware.

Logs request metadata only. Authorization, cookies, request bodies, and query
values are deliberately excluded so credentials and customer data cannot leak
into application logs.
"""
from __future__ import annotations

import logging
import time

from starlette.middleware.base import BaseHTTPMiddleware
from starlette.requests import Request
from starlette.responses import Response

from backend.middleware.request_context import get_request_id

logger = logging.getLogger("devonn.http")


class LoggingMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next) -> Response:
        started = time.perf_counter()
        status_code = 500
        try:
            response: Response = await call_next(request)
            status_code = response.status_code
            return response
        finally:
            duration_ms = round((time.perf_counter() - started) * 1000, 2)
            logger.info(
                "http_request method=%s path=%s status=%s duration_ms=%s request_id=%s",
                request.method,
                request.url.path,
                status_code,
                duration_ms,
                get_request_id() or request.headers.get("x-request-id", ""),
            )
