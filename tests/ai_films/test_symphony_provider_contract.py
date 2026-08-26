import pytest

from backend.ai_films.symphony_provider_contract import (
    SymphonyGenerationRequest,
    production_eligibility,
    validate_request,
)


def test_symphony_is_not_production_enabled_by_default():
    assert production_eligibility() is False


def test_text_request_is_valid():
    validate_request(
        SymphonyGenerationRequest(
            mode="text_to_video",
            prompt="A cinematic city at dusk",
        )
    )


def test_reference_modes_require_assets():
    with pytest.raises(ValueError):
        validate_request(
            SymphonyGenerationRequest(
                mode="reference_to_video",
                prompt="Animate the reference",
            )
        )


def test_duration_and_ratio_are_bounded():
    with pytest.raises(ValueError):
        validate_request(
            SymphonyGenerationRequest(
                mode="text_to_video",
                prompt="test",
                duration_seconds=31,
            )
        )
    with pytest.raises(ValueError):
        validate_request(
            SymphonyGenerationRequest(
                mode="text_to_video",
                prompt="test",
                aspect_ratio="4:3",
            )
        )
