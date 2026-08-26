import pytest

from backend.ai_films.symphony_adapter import (
    SymphonyConfigurationError,
    SymphonyNotEnabledError,
    build_symphony_request,
    submit_to_symphony,
)


def test_text_request_is_validated():
    request = build_symphony_request(mode="text_to_video", prompt="A cinematic city")
    assert request.duration_seconds == 10


def test_image_mode_requires_assets():
    with pytest.raises(SymphonyConfigurationError):
        build_symphony_request(mode="image_to_video", prompt="Animate this")


def test_duration_is_bounded():
    with pytest.raises(SymphonyConfigurationError):
        build_symphony_request(mode="text_to_video", prompt="scene", duration_seconds=31)


def test_transport_fails_closed():
    request = build_symphony_request(mode="text_to_video", prompt="scene")
    with pytest.raises(SymphonyNotEnabledError):
        submit_to_symphony(request)
