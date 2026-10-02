"""Redis-backed fixed-window HTTP rate limiting.

Production and staging fail closed if the shared limiter is unavailable. Local
and test environments may continue without Redis so developer workflows remain
usable.
"""
from __future__ import annotations

import logging
import os
import time

from redis.asyncio import Redis
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.requests import Request
from starlette.responses import JSONResponse, Response

logger = logging.getLogger(__name__)

_SKIP_PATHS = frozenset({"/health", "/health/live", "/health/ready", "/ready"})


def _strict_environment() -> bool:
    configured = os.getenv("ENVIRONMENT") or os.getenv("APP_ENV")
    if configured:
        return configured.lower() not in {"dev", "development", "local", "test", "testing"}
    # Pytest processes without an explicit environment are test execution, not
    # production. Explicit staging/production above still fail closed.
    if os.getenv("PYTEST_CURRENT_TEST"):
        return False
    return True


def _client_identity(request: Request) -> str:
    # Authentication happens in endpoint dependencies, after this middleware.
    # Never give an unverified credential or forwarded header a fresh allowance.
    # ASGI server proxy handling must be configured with trusted proxy addresses;
    # request.client then contains the server-validated client address.
    host = request.client.host if request.client else "unknown"
    return f"ip:{host}"


class RateLimitMiddleware(BaseHTTPMiddleware):
    def __init__(self, app, requests_per_minute: int | None = None):
        super().__init__(app)
        configured = os.getenv("RATE_LIMIT_REQUESTS_PER_MINUTE") or os.getenv("API_RATE_LIMIT_PER_MINUTE") or "120"
        self.limit = max(1, requests_per_minute or int(configured))
        self.redis_url = os.getenv("REDIS_URL", "").strip()
        self._redis: Redis | None = Redis.from_url(self.redis_url, decode_responses=True) if self.redis_url else None

    async def dispatch(self, request: Request, call_next) -> Response:
        if request.method == "OPTIONS" or request.url.path in _SKIP_PATHS:
            return await call_next(request)

        if self._redis is None:
            if _strict_environment():
                return JSONResponse(status_code=503, content={"detail": "Rate limiter unavailable"})
            return await call_next(request)

        window = int(time.time() // 60)
        identity = _client_identity(request)
        key = f"d3vonn:ratelimit:{identity}:{window}"
        try:
            count = await self._redis.incr(key)
            if count == 1:
                await self._redis.expire(key, 61)
        except Exception as exc:
            logger.error("Rate limiter Redis failure: %s", exc)
            if _strict_environment():
                return JSONResponse(status_code=503, content={"detail": "Rate limiter unavailable"})
            return await call_next(request)

        if count > self.limit:
            retry_after = 60 - int(time.time() % 60)
            return JSONResponse(
                status_code=429,
                content={"detail": "Rate limit exceeded"},
                headers={"Retry-After": str(retry_after)},
            )

        response: Response = await call_next(request)
        response.headers["X-RateLimit-Limit"] = str(self.limit)
        response.headers["X-RateLimit-Remaining"] = str(max(0, self.limit - count))
        return response
