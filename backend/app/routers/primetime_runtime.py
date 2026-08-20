"""PRIMETIME durable runtime orchestration boundary.

This module coordinates the ordering contract without enabling external side
 effects by itself. A production adapter must provide an atomic persistence
transaction and durable queue implementation.
"""
from __future__ import annotations

from dataclasses import dataclass
from typing import Protocol


@dataclass(frozen=True)
class IngestResult:
    request_id: str
    idempotency_key: str
    status: str
    duplicate: bool = False


class DurableIngestStore(Protocol):
    async def claim_idempotency(self, *, workspace_id: str, key: str, request_hash: str) -> bool: ...
    async def append_and_queue(self, *, workspace_id: str, request_id: str, key: str, payload: dict) -> None: ...


class IngestLock(Protocol):
    async def acquire(self, key: str, ttl_seconds: int) -> bool: ...
    async def release(self, key: str) -> None: ...


class DurableQueue(Protocol):
    async def enqueue(self, *, workspace_id: str, request_id: str, payload: dict) -> None: ...


class GovernedIngestRuntime:
    def __init__(self, *, store: DurableIngestStore, lock: IngestLock, queue: DurableQueue) -> None:
        self.store = store
        self.lock = lock
        self.queue = queue

    async def accept(self, *, workspace_id: str, request_id: str, idempotency_key: str, request_hash: str, payload: dict) -> IngestResult:
        lock_key = f"primetime:ingest:{workspace_id}:{idempotency_key}"
        if not await self.lock.acquire(lock_key, 60):
            raise RuntimeError("ingest is already being processed")
        try:
            claimed = await self.store.claim_idempotency(
                workspace_id=workspace_id,
                key=idempotency_key,
                request_hash=request_hash,
            )
            if not claimed:
                return IngestResult(request_id=request_id, idempotency_key=idempotency_key, status="duplicate", duplicate=True)

            # The store must commit the durable record and queue intent before
            # this method reports acceptance. The queue adapter is responsible
            # for durable delivery/recovery semantics.
            await self.store.append_and_queue(
                workspace_id=workspace_id,
                request_id=request_id,
                key=idempotency_key,
                payload=payload,
            )
            await self.queue.enqueue(workspace_id=workspace_id, request_id=request_id, payload=payload)
            return IngestResult(request_id=request_id, idempotency_key=idempotency_key, status="accepted")
        finally:
            await self.lock.release(lock_key)
