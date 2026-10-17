"""Tests for the fail-closed Hermes voice authorization boundary."""
from datetime import datetime, timedelta, timezone
from uuid import uuid4
import pytest

from backend.hermes.voice_authorization import authorize_hermes_voice_action


@pytest.mark.asyncio
async def test_owned_active_voice_session():
    user, session = uuid4(), uuid4()
    now = datetime.now(timezone.utc)
    record = dict(id=str(session), user_id=str(user), created_at=now-timedelta(seconds=5),
                  expires_at=now+timedelta(seconds=295), revoked_at=None)
    async def load(_):
        return record
    assert await authorize_hermes_voice_action(str(session), str(user), load, now=now)
    assert not await authorize_hermes_voice_action(str(session), str(uuid4()), load, now=now)
    assert not await authorize_hermes_voice_action(str(uuid4()), str(user), load, now=now)


@pytest.mark.asyncio
async def test_revoked_expired_or_missing_session_denied():
    user, session = uuid4(), uuid4()
    now = datetime.now(timezone.utc)
    base = dict(id=str(session), user_id=str(user), created_at=now-timedelta(seconds=10),
                expires_at=now+timedelta(seconds=290), revoked_at=None)
    async def revoked(_):
        return {**base, "revoked_at": now}
    async def expired(_):
        return {**base, "expires_at": now}
    async def missing(_):
        return None
    for loader in (revoked, expired, missing):
        assert not await authorize_hermes_voice_action(str(session), str(user), loader, now=now)


@pytest.mark.asyncio
async def test_database_failure_denied():
    async def fail(_):
        raise RuntimeError("database unavailable")
    assert not await authorize_hermes_voice_action(str(uuid4()), str(uuid4()), fail)
