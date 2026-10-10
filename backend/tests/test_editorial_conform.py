from pathlib import Path

import pytest

from backend.ai_films.editorial_conform import (
    EditorialConformError,
    build_editorial_conform_manifest,
    timecode_for_index,
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


def test_manifest_preserves_real_vfr_pts():
    manifest = build_editorial_conform_manifest(
        source_path="vfr.mov",
        exr_frames=["frame_00000001.exr", "frame_00000002.exr", "frame_00000003.exr"],
        frame_rate=29.97,
        source_pts_seconds=[0.0, 0.041, 0.083],
    )
    assert [frame.source_pts_seconds for frame in manifest.frames] == [0.0, 0.041, 0.083]


def test_vfr_pts_count_must_match_frames():
    with pytest.raises(EditorialConformError):
        build_editorial_conform_manifest(
            source_path="vfr.mov",
            exr_frames=["frame_00000001.exr", "frame_00000002.exr"],
            frame_rate=29.97,
            source_pts_seconds=[0.0],
        )


def test_ntsc_rate_is_normalized_to_rational():
    manifest = build_editorial_conform_manifest(
        source_path="camera.mov",
        exr_frames=["frame_00000001.exr"],
        frame_rate=23.976,
    )
    assert (manifest.frame_rate_numerator, manifest.frame_rate_denominator) == (24000, 1001)


def test_drop_frame_skips_invalid_minute_labels():
    assert timecode_for_index("00:00:59;29", 1, 29.97) == "00:01:00;02"
    assert timecode_for_index("00:09:59;29", 1, 29.97) == "00:10:00;00"


def test_invalid_drop_frame_label_is_rejected():
    with pytest.raises(EditorialConformError):
        timecode_for_index("00:01:00;00", 0, 29.97)


def test_otio_payload_contains_real_image_sequence_track(tmp_path: Path):
    frames = [tmp_path / "frame_00000001.exr", tmp_path / "frame_00000002.exr"]
    manifest = build_editorial_conform_manifest(
        source_path="camera.mov",
        exr_frames=frames,
        frame_rate=24.0,
        start_timecode="10:00:00:00",
    )
    payload = to_otio_dict(manifest)
    assert payload["OTIO_SCHEMA"].startswith("Timeline")
    assert payload["metadata"]["ai_films"]["start_timecode"] == "10:00:00:00"
    assert payload["metadata"]["ai_films"]["frame_count"] == 2
    tracks = payload["tracks"]["children"]
    assert len(tracks) == 1
    clips = tracks[0]["children"]
    assert len(clips) == 1
    media_refs = clips[0]["media_references"]
    media_ref = next(iter(media_refs.values()))
    assert media_ref["OTIO_SCHEMA"].startswith("ImageSequenceReference")
    assert media_ref["name_prefix"] == "frame_"
    assert media_ref["start_frame"] == 1
    assert media_ref["frame_zero_padding"] == 8
