from datetime import datetime, timezone

import pytest
from fastapi import HTTPException

from backend.api.v1.wearable_router import WearableEvent, _validate_event


def make_event(event_type="audio.command", capabilities=None, consent=True):
    return WearableEvent(
        event_id="event-1",
        event_type=event_type,
        occurred_at=datetime.now(timezone.utc),
        source={"adapter": "meta-display-webapp", "device_id": "display-1", "session_id": "session-1"},
        correlation_id="corr-1",
        privacy={"classification": "user_private", "consent": consent},
        payload={"command": "ask_d3vonn"},
        capabilities=capabilities or ["microphone", "speaker"],
        audit={"policy_version": "wearable-v1", "trace_id": "trace-1"},
    )


def test_accepts_consented_audio_event():
    _validate_event(make_event())


def test_rejects_missing_consent():
    with pytest.raises(HTTPException) as exc:
        _validate_event(make_event(consent=False))
    assert exc.value.status_code == 403


def test_rejects_vision_without_camera_capability():
    with pytest.raises(HTTPException) as exc:
        _validate_event(make_event(event_type="vision.frame", capabilities=["microphone"]))
    assert exc.value.status_code == 422


def test_rejects_unknown_event_namespace():
    with pytest.raises(HTTPException) as exc:
        _validate_event(make_event(event_type="system.exec"))
    assert exc.value.status_code == 422
