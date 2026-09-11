from datetime import datetime, timezone

import pytest
from fastapi import HTTPException

from backend.api.v1.wearable_router import WearableEvent, _validate_event


def make_event(**overrides):
    data = {
        "event_id": "evt-1",
        "event_type": "vision.entity.detected",
        "occurred_at": datetime.now(timezone.utc).isoformat(),
        "source": {"adapter": "meta-dat", "device_id": "device-1", "session_id": "session-1"},
        "correlation_id": "run-1",
        "privacy": {"classification": "user_private", "consent": True},
        "payload": {"entity": "company"},
        "capabilities": ["camera"],
        "audit": {"policy_version": "wearable-v1", "trace_id": "trace-1"},
    }
    data.update(overrides)
    return WearableEvent.model_validate(data)


def test_valid_vision_event():
    _validate_event(make_event())


def test_consent_is_required():
    event = make_event(privacy={"classification": "user_private", "consent": False})
    with pytest.raises(HTTPException) as exc:
        _validate_event(event)
    assert exc.value.status_code == 403


def test_vision_requires_camera_capability():
    event = make_event(capabilities=[])
    with pytest.raises(HTTPException) as exc:
        _validate_event(event)
    assert exc.value.status_code == 422


def test_audio_requires_audio_capability():
    event = make_event(event_type="audio.command.received", capabilities=[])
    with pytest.raises(HTTPException) as exc:
        _validate_event(event)
    assert exc.value.status_code == 422
