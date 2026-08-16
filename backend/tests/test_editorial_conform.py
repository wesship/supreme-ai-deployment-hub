from backend.ai_films.editorial_conform import (
    build_editorial_conform_manifest,
    to_otio_dict,
)


def test_manifest_preserves_frame_identity_and_pts():
    manifest = build_editorial_conform_manifest(
        source_path="camera.mov",
        exr_frames=["frame_00000001.exr", "frame_00000002.exr"],
        frame_rate=24.0,
        start_timecode="01:00:00:00",
    )
    assert manifest.frame_rate_numerator == 24
    assert manifest.frame_rate_denominator == 1
    assert manifest.frames[0].source_pts_seconds == 0.0
    assert manifest.frames[0].source_timecode == "01:00:00:00"
    assert manifest.frames[1].source_pts_seconds == 1 / 24
    assert manifest.frames[1].source_timecode == "01:00:00:01"


def test_ntsc_rate_is_normalized_to_rational():
    manifest = build_editorial_conform_manifest(
        source_path="camera.mov",
        exr_frames=["frame.exr"],
        frame_rate=23.976,
    )
    assert (manifest.frame_rate_numerator, manifest.frame_rate_denominator) == (24000, 1001)


def test_otio_payload_contains_conform_provenance():
    manifest = build_editorial_conform_manifest(
        source_path="camera.mov",
        exr_frames=["frame.exr"],
        frame_rate=24.0,
        start_timecode="10:00:00:00",
    )
    payload = to_otio_dict(manifest)
    assert payload["OTIO_SCHEMA"] == "Timeline.1"
    assert payload["metadata"]["ai_films"]["start_timecode"] == "10:00:00:00"
    assert payload["metadata"]["ai_films"]["frame_count"] == 1
