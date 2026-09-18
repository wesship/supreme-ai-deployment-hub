from backend.ai_films.openmontage_router import (
    _resolution_for_aspect,
    _segment_prompt,
    _shot_durations,
)
from backend.ai_films.openmontage_assembly_coordinator import _assembly_input


def test_openmontage_splits_fifteen_second_ad_into_provider_safe_shots():
    assert _shot_durations(15) == [8, 7]
    assert all(5 <= value <= 10 for value in _shot_durations(20))


def test_openmontage_vertical_contract_maps_to_1080x1920():
    assert _resolution_for_aspect("9:16") == "1080x1920"
    assert _resolution_for_aspect("16:9") == "1920x1080"


def test_openmontage_segment_prompt_preserves_base_and_final_cta_direction():
    prompt = _segment_prompt("D3VONN Command Beacon", 1, 2)
    assert "D3VONN Command Beacon" in prompt
    assert "exact approved call to action" in prompt
    assert prompt.startswith("OpenMontage multishot direction:")


def test_openmontage_assembly_input_orders_shots_and_preserves_vertical_contract():
    jobs = [
        {
            "id": "job-2",
            "input": {
                "openmontage_job_id": "om-1",
                "openmontage_shot_index": 1,
                "openmontage_target_duration_seconds": 15,
                "openmontage_aspect_ratio": "9:16",
                "openmontage_resolution": "1080x1920",
                "shot_id": "shot-2",
                "generation_packet": {"duration_target_seconds": 7},
            },
            "output": {"generated_asset_id": "asset-2"},
        },
        {
            "id": "job-1",
            "input": {
                "openmontage_job_id": "om-1",
                "openmontage_shot_index": 0,
                "openmontage_target_duration_seconds": 15,
                "openmontage_aspect_ratio": "9:16",
                "openmontage_resolution": "1080x1920",
                "shot_id": "shot-1",
                "generation_packet": {"duration_target_seconds": 8},
            },
            "output": {"generated_asset_id": "asset-1"},
        },
    ]

    payload = _assembly_input(jobs)

    assert payload["aspect_ratio"] == "9:16"
    assert payload["resolution"] == "1080x1920"
    assert payload["planned_runtime_seconds"] == 15
    assert [clip["asset_id"] for clip in payload["timeline"]] == ["asset-1", "asset-2"]


def test_openmontage_long_prompt_keeps_segment_direction():
    prompt = _segment_prompt("x" * 12000, 1, 2)
    assert len(prompt) <= 12000
    assert prompt.startswith("OpenMontage multishot direction:")
    assert "exact approved call to action" in prompt[:500]
