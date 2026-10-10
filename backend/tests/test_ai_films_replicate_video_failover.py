from backend.ai_films.replicate_video_fallback import (
    ReplicateVideoClient,
    is_retryable_pollo_failure,
)


def test_retryable_pollo_provider_failures_are_eligible_for_failover():
    assert is_retryable_pollo_failure(RuntimeError("Pollo status failed with HTTP 503"))
    assert is_retryable_pollo_failure(RuntimeError("Pollo video generation timed out"))
    assert is_retryable_pollo_failure(RuntimeError("connection reset by peer"))


def test_non_provider_failures_do_not_trigger_paid_fallback():
    assert not is_retryable_pollo_failure(RuntimeError("Video job is missing shot_id"))
    assert not is_retryable_pollo_failure(RuntimeError("Character generation requires an approved input reference"))
    assert not is_retryable_pollo_failure(RuntimeError("Canon anchor has no private storage object path"))


def test_replicate_fallback_defaults_to_stable_official_video_model():
    client = ReplicateVideoClient({"REPLICATE_API_TOKEN": "test-token"})
    assert client.model == "bytedance/seedance-1-lite"
