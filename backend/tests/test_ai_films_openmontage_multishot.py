import asyncio

from backend.ai_films.openmontage_router import (
    _resolution_for_aspect,
    _segment_prompt,
    _shot_durations,
)
from backend.ai_films.assembly_worker import AssemblyWorkerError
from backend.ai_films.openmontage_assembly_coordinator import _assembly_input, _next_ready_group, _queue_assembly


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


def test_coordinator_reaches_ready_group_after_thousand_old_jobs():
    older = [{"id": f"old-{i}", "input": {}} for i in range(1000)]
    source = {
        "id": "source-1", "project_id": "project-1", "status": "completed",
        "input": {"openmontage_job_id": "group-1", "openmontage_shot_count": 2},
        "output": {"generated_asset_id": "asset-1", "qa": {"state": "passed"}},
    }
    second = {
        **source, "id": "source-2",
        "output": {"generated_asset_id": "asset-2", "qa": {"state": "passed"}},
    }

    class FakeDB:
        async def _request(self, method, table, *, params):
            if params.get("job_type") == "eq.assembly":
                return []
            if params.get("project_id"):
                return [source, second]
            offset = int(params["offset"])
            return (older + [source])[offset : offset + int(params["limit"])]

    group = asyncio.run(_next_ready_group(FakeDB()))
    assert [job["id"] for job in group] == ["source-1", "source-2"]


def test_coordinator_reuses_winning_assembly_after_unique_conflict():
    jobs = [{
        "id": "source-1", "project_id": "project-1", "owner_id": "owner-1",
        "input": {"openmontage_job_id": "group-1", "openmontage_shot_index": 0},
        "output": {"generated_asset_id": "asset-1"},
    }]

    class FakeDB:
        async def _request(self, method, table, *, params=None, payload=None, representation=False):
            if method == "POST":
                raise AssemblyWorkerError("Supabase assembly request failed with HTTP 409")
            assert params["input->>openmontage_job_id"] == "eq.group-1"
            return [{"id": "winner", "project_id": "project-1"}]

    assert asyncio.run(_queue_assembly(FakeDB(), jobs))["id"] == "winner"
