"""Fast-path Redis lock for PRIMETIME ingestion.

Redis prevents concurrent workers from processing the same workspace/key. The
Postgres idempotency table remains the durable source of truth and must still
be checked before a request is considered accepted.
"""
from __future__ import annotations

import hashlib
import os
from dataclasses import dataclass

import redis.asyncio as redis


@dataclass(frozen=True)
class IdempotencyLock:
    acquired: bool
    key: str
    token: str


def request_hash(raw_body: bytes) -> str:
    return hashlib.sha256(raw_body).hexdigest()


async def acquire_ingest_lock(*, workspace_id: str, idempotency_key: str, token: str, ttl_seconds: int = 120) -> IdempotencyLock:
    redis_url = os.getenv("REDIS_URL", "")
    if not redis_url:
        raise RuntimeError("REDIS_URL is required for PRIMETIME ingest locking")
    key = f"primetime:ingest:{workspace_id}:{idempotency_key}"
    client = redis.from_url(redis_url, decode_responses=True)
    try:
        acquired = bool(await client.set(key, token, nx=True, ex=ttl_seconds))
        return IdempotencyLock(acquired=acquired, key=key, token=token)
    finally:
        await client.aclose()
