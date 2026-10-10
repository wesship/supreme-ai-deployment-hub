"""
Devonn.ai Backend Proxy — Rate Limiting
Simple in-memory sliding-window rate limiter per user ID.
For production at scale, replace with Redis-backed slowapi or similar.
"""
import time
from collections import defaultdict, deque
from typing import Callable

from fastapi import HTTPException, Request, status


class SlidingWindowRateLimiter:
    """
    Sliding-window rate limiter.
    Tracks request timestamps per key in a deque.
    """

    def __init__(self) -> None:
        self._windows: dict[str, deque[float]] = defaultdict(deque)

    def is_allowed(self, key: str, limit: int, window_seconds: int = 60) -> bool:
        now = time.monotonic()
        cutoff = now - window_seconds
        window = self._windows[key]

        # Evict old entries
        while window and window[0] < cutoff:
            window.popleft()

        if len(window) >= limit:
            return False

        window.append(now)
        return True


_limiter = SlidingWindowRateLimiter()


def rate_limit(limit: int, window_seconds: int = 60) -> Callable:
    """
    FastAPI dependency factory.
    Usage: Depends(rate_limit(20))  — 20 requests per minute per user/IP
    """
    async def dependency(request: Request) -> None:
        # Key by user ID if available (set by auth middleware), else by IP
        user_id: str = getattr(request.state, "user_id", None) or (
            request.client.host if request.client else "anonymous"
        )
        key = f"{request.url.path}:{user_id}"

        if not _limiter.is_allowed(key, limit, window_seconds):
            raise HTTPException(
                status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                detail=f"Rate limit exceeded: {limit} requests per {window_seconds}s",
                headers={"Retry-After": str(window_seconds)},
            )

    return dependency
