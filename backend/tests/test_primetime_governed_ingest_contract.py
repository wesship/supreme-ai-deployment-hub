import hashlib
import hmac
import time

import pytest
from fastapi import HTTPException

from backend.app.routers.primetime_governed_ingest import _validate_signature


def test_valid_signature_is_accepted(monkeypatch):
    secret = "test-secret"
    monkeypatch.setenv("PRIMETIME_INGEST_SIGNING_SECRET", secret)
    import backend.app.routers.primetime_governed_ingest as module
    monkeypatch.setattr(module, "INGEST_SIGNING_SECRET", secret)
    timestamp = str(int(time.time()))
    body = b'{"event_type":"interaction.received"}'
    signature = hmac.new(secret.encode(), timestamp.encode() + b"." + body, hashlib.sha256).hexdigest()
    _validate_signature(timestamp, f"sha256={signature}", body)


def test_replay_window_is_enforced(monkeypatch):
    import backend.app.routers.primetime_governed_ingest as module
    monkeypatch.setattr(module, "INGEST_SIGNING_SECRET", "test-secret")
    old_timestamp = str(int(time.time()) - module.REPLAY_WINDOW_SECONDS - 1)
    body = b"{}"
    signature = hmac.new(b"test-secret", old_timestamp.encode() + b"." + body, hashlib.sha256).hexdigest()
    with pytest.raises(HTTPException) as exc:
        _validate_signature(old_timestamp, f"sha256={signature}", body)
    assert exc.value.status_code == 401


def test_signature_mismatch_is_rejected(monkeypatch):
    import backend.app.routers.primetime_governed_ingest as module
    monkeypatch.setattr(module, "INGEST_SIGNING_SECRET", "test-secret")
    timestamp = str(int(time.time()))
    with pytest.raises(HTTPException) as exc:
        _validate_signature(timestamp, "sha256=bad", b"{}")
    assert exc.value.status_code == 401
