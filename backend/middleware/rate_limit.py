"""Redis-backed fixed-window HTTP rate limiting.

The limiter is intentionally simple and deterministic. In staging/production it
fails closed if Redis is unavailable; local/test environments may fail open so
developers are not locked out when Redis is not running.
"""
from __future__ import annotations

import hashlib
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
    env = (os.getenv("ENVIRONMENT") or os.getenv("APP_ENV") or "production").lower()
    return env not in {"dev", "development", "local", "test", "testing"}


def _client_identity(request: Request) -> str:
    authorization = request.headers.get("authorization", "")
    if authorization.lower().startswith("bearer "):
        digest = hashlib.sha256(authorization[7:].encode("utf-8")).hexdigest()
        return f"token:{digest[:24]}"
    forwarded = request.headers.get("x-forwarded-for", "").split(",", 1)[0].strip()
    host = forwarded or (request.client.host if request.client else "unknown")
    return f"ip:{host}"


class RateLimitMiddleware(BaseHTTPMiddleware):
    def __init__(self, app):
        super().__init__(app)
        self.limit = max(1, int(os.getenv("RATE_LIMIT_REQUESTS_PER_MINUTE", "120")))
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
        key = f"devonn:ratelimit:{identity}:{window}"
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
