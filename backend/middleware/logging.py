"""Structured HTTP request logging middleware for D3VONN.IO."""
from __future__ import annotations

import logging
import time

from starlette.middleware.base import BaseHTTPMiddleware
from starlette.requests import Request
from starlette.responses import Response

from backend.middleware.request_context import get_request_id

logger = logging.getLogger("d3vonn.http")


class LoggingMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next) -> Response:
        started = time.perf_counter()
        try:
            response = await call_next(request)
        except Exception:
            logger.exception(
                "request_failed method=%s path=%s request_id=%s",
                request.method,
                request.url.path,
                get_request_id(),
            )
            raise
        elapsed_ms = (time.perf_counter() - started) * 1000
        logger.info(
            "request_complete method=%s path=%s status=%s duration_ms=%.2f request_id=%s",
            request.method,
            request.url.path,
            response.status_code,
            elapsed_ms,
            get_request_id(),
        )
        return response
