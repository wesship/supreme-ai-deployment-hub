"""In-process defensive rate limiter for D3VONN.IO API.

This provides a fail-safe per-instance limit. Distributed edge/Redis limits may be
layered on top without removing this protection.
"""
from __future__ import annotations

import os
import time
from collections import defaultdict, deque
from threading import Lock

from starlette.middleware.base import BaseHTTPMiddleware
from starlette.requests import Request
from starlette.responses import JSONResponse, Response


class RateLimitMiddleware(BaseHTTPMiddleware):
    def __init__(self, app, requests_per_minute: int | None = None):
        super().__init__(app)
        self.limit = requests_per_minute or int(os.getenv("API_RATE_LIMIT_PER_MINUTE", "120"))
        self._hits: dict[str, deque[float]] = defaultdict(deque)
        self._lock = Lock()

    def _key(self, request: Request) -> str:
        forwarded = request.headers.get("x-forwarded-for", "").split(",")[0].strip()
        client = forwarded or (request.client.host if request.client else "unknown")
        return f"{client}:{request.url.path}"

    async def dispatch(self, request: Request, call_next) -> Response:
        if request.method == "OPTIONS" or request.url.path in {"/health", "/health/live", "/ready", "/health/ready"}:
            return await call_next(request)

        now = time.monotonic()
        cutoff = now - 60.0
        key = self._key(request)
        with self._lock:
            hits = self._hits[key]
            while hits and hits[0] < cutoff:
                hits.popleft()
            if len(hits) >= self.limit:
                return JSONResponse(
                    status_code=429,
                    content={"detail": "rate limit exceeded"},
                    headers={"Retry-After": "60"},
                )
            hits.append(now)
        return await call_next(request)
