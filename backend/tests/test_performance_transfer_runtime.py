from __future__ import annotations

import pytest

from backend.ai_films.performance_transfer_qa_worker import _decision_with_thresholds
from backend.ai_films.performance_transfer_worker import (
    PerformanceTransferWorkerError,
    _build_provider_input,
    _input_map,
    _output_url,
)


def test_default_replicate_input_mapping_is_minimal():
    mapped = _build_provider_input(
        driving_video_url="https://signed.example/driving.mp4",
        reference_image_urls=["https://signed.example/legend.png"],
        target_character_id="legend",
        motion_transfer={"face": True, "head": True, "body": True},
        continuity={"preserve_camera": True, "preserve_wardrobe": True},
        metadata={},
        environ={},
    )
    assert mapped == {
        "driving_video": "https://signed.example/driving.mp4",
        "reference_image": "https://signed.example/legend.png",
    }


def test_replicate_input_mapping_supports_model_specific_fields():
    env = {
        "AI_FILM_REPLICATE_PERFORMANCE_INPUT_MAP_JSON": (
            '{"driving_video_url":"video","reference_image_urls":"images",'
            '"transfer_face_motion":"use_face","transfer_body_motion":"use_body"}'
        )
    }
    mapped = _build_provider_input(
        driving_video_url="https://signed.example/driving.mp4",
        reference_image_urls=["https://signed.example/a.png", "https://signed.example/b.png"],
        target_character_id="legend",
        motion_transfer={"face": True, "head": False, "body": True},
        continuity={},
        metadata={"provider_input": {"seed": 42}},
        environ=env,
    )
    assert mapped == {
        "video": "https://signed.example/driving.mp4",
        "images": ["https://signed.example/a.png", "https://signed.example/b.png"],
        "use_face": True,
        "use_body": True,
        "seed": 42,
    }


def test_invalid_input_mapping_fails_closed():
    with pytest.raises(PerformanceTransferWorkerError, match="invalid JSON"):
        _input_map({"AI_FILM_REPLICATE_PERFORMANCE_INPUT_MAP_JSON": "{"})


def test_output_url_handles_nested_replicate_outputs():
    assert _output_url({"output": [{"video": {"url": "https://cdn.example/result.mp4"}}]}) == (
        "https://cdn.example/result.mp4"
    )


def test_qa_pass_requires_all_thresholds():
    env = {
        "AI_FILM_PERFORMANCE_IDENTITY_PASS_SCORE": "0.85",
        "AI_FILM_PERFORMANCE_MOTION_PASS_SCORE": "0.80",
        "AI_FILM_PERFORMANCE_WARDROBE_PASS_SCORE": "0.80",
        "AI_FILM_PERFORMANCE_TEMPORAL_PASS_SCORE": "0.80",
    }
    decision, scores = _decision_with_thresholds(
        {
            "decision": "pass",
            "identity_score": 0.93,
            "motion_fidelity_score": 0.91,
            "wardrobe_continuity_score": 0.90,
            "temporal_stability_score": 0.88,
        },
        env,
    )
    assert decision == "pass"
    assert scores["identity"] == pytest.approx(0.93)


def test_qa_downgrades_nominal_pass_when_identity_drifts():
    decision, scores = _decision_with_thresholds(
        {
            "decision": "pass",
            "identity_score": 0.64,
            "motion_fidelity_score": 0.95,
            "wardrobe_continuity_score": 0.95,
            "temporal_stability_score": 0.95,
        },
        {},
    )
    assert decision == "revise"
    assert scores["identity"] == pytest.approx(0.64)


def test_qa_block_is_never_promoted_by_scores():
    decision, _ = _decision_with_thresholds(
        {
            "decision": "block",
            "identity_score": 1,
            "motion_fidelity_score": 1,
            "wardrobe_continuity_score": 1,
            "temporal_stability_score": 1,
        },
        {},
    )
    assert decision == "block"
