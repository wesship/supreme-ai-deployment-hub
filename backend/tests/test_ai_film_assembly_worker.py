from backend.ai_films.assembly_worker import (
    AssemblyBlocked,
    build_filter_complex,
    resolve_asset_source,
)


def test_movieflow_asset_resolves_canonical_media_url():
    source = resolve_asset_source(
        {
            "id": "asset-1",
            "title": "clip.mp4",
            "source_filename": "clip.mp4",
            "storage_path": "https://example.invalid/old.mp4",
            "metadata": {
                "source_type": "movieflow",
                "canonical_media_url": "https://oss1.movieflow.ai/portrait/clip.mp4",
            },
        }
    )
    assert source.media_url == "https://oss1.movieflow.ai/portrait/clip.mp4"
    assert source.source_type == "movieflow"


def test_google_drive_share_link_is_blocked_for_materialization():
    try:
        resolve_asset_source(
            {
                "id": "asset-drive",
                "title": "drive.mp4",
                "source_filename": "drive.mp4",
                "storage_path": "https://drive.google.com/file/d/abc/view",
                "metadata": {"source_type": "google_drive"},
            }
        )
    except AssemblyBlocked as exc:
        assert exc.reason == "materialization_required"
    else:
        raise AssertionError("Drive share link should not be treated as server-renderable")


def test_filter_complex_builds_dissolve_and_silent_audio_when_needed():
    timeline = [
        {
            "asset_id": "a",
            "source_in": 0.0,
            "source_out": 3.0,
            "transition_in": "cut",
            "transition_out": "dissolve",
        },
        {
            "asset_id": "b",
            "source_in": 1.0,
            "source_out": 5.0,
            "transition_in": "dissolve",
            "transition_out": "cut",
        },
    ]
    graph, video, audio, runtime, warnings = build_filter_complex(
        timeline,
        [True, False],
        width=1920,
        height=1080,
        fps=24,
    )
    assert "xfade=transition=fade" in graph
    assert "acrossfade=" in graph
    assert "anullsrc" in graph
    assert video == "vx1"
    assert audio == "ax1"
    assert 6.0 < runtime < 7.0
    assert warnings == []


def test_match_cut_is_deterministic_cut_with_warning():
    timeline = [
        {"source_in": 0.0, "source_out": 2.0, "transition_out": "match_cut"},
        {"source_in": 0.0, "source_out": 2.0, "transition_in": "match_cut"},
    ]
    graph, _, _, runtime, warnings = build_filter_complex(
        timeline,
        [True, True],
        width=1080,
        height=1920,
        fps=30,
    )
    assert "concat=n=2:v=1:a=1" in graph
    assert runtime == 4.0
    assert any("match_cut" in warning for warning in warnings)
