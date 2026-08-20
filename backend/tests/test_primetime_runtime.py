import pytest

from backend.app.routers.primetime_runtime import GovernedIngestRuntime


class FakeLock:
    def __init__(self, acquired=True):
        self.acquired = acquired
        self.released = []

    async def acquire(self, key, ttl_seconds):
        return self.acquired

    async def release(self, key):
        self.released.append(key)


class FakeStore:
    def __init__(self, claimed=True):
        self.claimed = claimed
        self.calls = []

    async def claim_idempotency(self, **kwargs):
        self.calls.append(("claim", kwargs))
        return self.claimed

    async def append_and_queue(self, **kwargs):
        self.calls.append(("persist", kwargs))


class FakeQueue:
    def __init__(self):
        self.calls = []

    async def enqueue(self, **kwargs):
        self.calls.append(kwargs)


@pytest.mark.asyncio
async def test_duplicate_stops_before_persistence():
    lock, store, queue = FakeLock(), FakeStore(claimed=False), FakeQueue()
    result = await GovernedIngestRuntime(store=store, lock=lock, queue=queue).accept(
        workspace_id="w", request_id="r", idempotency_key="idem-1234", request_hash="hash", payload={}
    )
    assert result.duplicate is True
    assert not any(call[0] == "persist" for call in store.calls)
    assert queue.calls == []


@pytest.mark.asyncio
async def test_accept_persists_before_queue():
    lock, store, queue = FakeLock(), FakeStore(), FakeQueue()
    result = await GovernedIngestRuntime(store=store, lock=lock, queue=queue).accept(
        workspace_id="w", request_id="r", idempotency_key="idem-1234", request_hash="hash", payload={"x": 1}
    )
    assert result.status == "accepted"
    assert [c[0] for c in store.calls] == ["claim", "persist"]
    assert len(queue.calls) == 1
    assert lock.released == ["primetime:ingest:w:idem-1234"]


@pytest.mark.asyncio
async def test_lock_contention_fails_closed():
    lock, store, queue = FakeLock(acquired=False), FakeStore(), FakeQueue()
    with pytest.raises(RuntimeError):
        await GovernedIngestRuntime(store=store, lock=lock, queue=queue).accept(
            workspace_id="w", request_id="r", idempotency_key="idem-1234", request_hash="hash", payload={}
        )
    assert store.calls == []
    assert queue.calls == []
