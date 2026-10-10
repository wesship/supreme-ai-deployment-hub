from backend.ai_films.director import ClipSpec, fallback_plan, generate_cmx_edl, normalize_timeline
from backend.ai_films.providers import provider_health


def test_director_fallback_builds_contiguous_timeline_and_edl():
    clips = [
        ClipSpec(asset_id="asset-a", label="Opening", duration_seconds=5.0),
        ClipSpec(asset_id="asset-b", label="Reveal", duration_seconds=8.0, source_in=1.0, source_out=6.0),
    ]
    plan = fallback_plan(clips, "The Sovereign Signal")
    timeline = normalize_timeline(plan, clips)

    assert len(timeline) == 2
    assert timeline[0]["record_in"] == 0.0
    assert timeline[0]["record_out"] == 5.0
    assert timeline[1]["record_in"] == 5.0
    assert timeline[1]["record_out"] == 10.0

    edl = generate_cmx_edl(timeline, "The Sovereign Signal", fps=24)
    assert "TITLE: The Sovereign Signal" in edl
    assert "D3VONN ASSET ID: asset-a" in edl
    assert "D3VONN ASSET ID: asset-b" in edl
    assert "00:00:05:00" in edl


def test_director_rejects_unknown_and_duplicate_assets_during_normalization():
    clips = [ClipSpec(asset_id="asset-a", label="Only", duration_seconds=10.0)]
    plan = {
        "sequence": [
            {"asset_id": "unknown", "source_in": 0, "source_out": 2},
            {"asset_id": "asset-a", "source_in": 2, "source_out": 8},
            {"asset_id": "asset-a", "source_in": 0, "source_out": 2},
        ]
    }
    timeline = normalize_timeline(plan, clips)
    assert len(timeline) == 1
    assert timeline[0]["asset_id"] == "asset-a"
    assert timeline[0]["source_in"] == 2.0
    assert timeline[0]["source_out"] == 8.0


def test_ffmpeg_assembly_capability_is_always_available():
    health = provider_health({})
    assert health["capabilities"]["assembly"] is True
    ffmpeg = [p for p in health["providers"] if p["capability"] == "assembly" and p["provider"] == "ffmpeg"]
    assert ffmpeg and ffmpeg[0]["status"] == "configured"
