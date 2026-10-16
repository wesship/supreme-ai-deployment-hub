from types import SimpleNamespace
import pytest
from fastapi import HTTPException

from backend.music import stem_gate12_router as gate


def test_rejects_missing_bearer():
    with pytest.raises(HTTPException) as exc:
        gate.bearer_token(None)
    assert exc.value.status_code == 401


@pytest.mark.asyncio
async def test_capabilities_are_fail_closed(monkeypatch):
    class FakeClient:
        def __init__(self, token):
            assert token == "test-token"
        async def current_user(self):
            return SimpleNamespace(id="00000000-0000-4000-8000-000000000001")
    monkeypatch.setattr(gate, "SupabaseRLSClient", FakeClient)
    result = await gate.get_capabilities("Bearer test-token")
    assert not result.separation_enabled
    assert not result.upload_enabled
    assert not result.queue_enabled


@pytest.mark.asyncio
async def test_cross_account_cannot_read_ungrounded_job(monkeypatch):
    class FakeClient:
        def __init__(self, token):
            pass
        async def current_user(self):
            return SimpleNamespace(id="00000000-0000-4000-8000-000000000002")
    monkeypatch.setattr(gate, "SupabaseRLSClient", FakeClient)
    with pytest.raises(HTTPException) as exc:
        await gate.get_job("00000000-0000-4000-8000-000000000001", "Bearer token")
    assert exc.value.status_code == 503


@pytest.mark.asyncio
async def test_upload_and_queue_never_dispatch(monkeypatch):
    async def valid_owner(_):
        return "00000000-0000-4000-8000-000000000001"
    monkeypatch.setattr(gate, "verified_owner", valid_owner)
    for call in (gate.upload_not_ready, gate.submit_not_ready):
        with pytest.raises(HTTPException) as exc:
            await call("Bearer token")
        assert exc.value.status_code == 503
