from pathlib import Path

import pytest

from backend.ai_films.media_metadata import (
    MediaProbeFailedError,
    parse_ffprobe_payload,
    probe_media_metadata,
    resolve_media_camera_color,
)


def test_parse_ffprobe_payload_normalizes_video_metadata():
    payload = {
        "streams": [
            {
                "codec_type": "video",
                "codec_name": "prores",
                "codec_long_name": "Apple ProRes",
                "width": 4096,
                "height": 2160,
                "pix_fmt": "yuv422p10le",
                "bits_per_raw_sample": "10",
                "avg_frame_rate": "24000/1001",
                "color_range": "tv",
                "color_space": "bt2020nc",
                "color_transfer": "arib-std-b67",
                "color_primaries": "bt2020",
                "tags": {
                    "com.apple.quicktime.make": "ARRI",
                    "com.apple.quicktime.model": "ALEXA 35",
                    "gamma": "ARRI LogC4",
                },
            }
        ],
        "format": {
            "format_name": "mov,mp4,m4a,3gp,3g2,mj2",
            "duration": "12.500000",
            "bit_rate": "640000000",
            "tags": {"encoder": "camera"},
        },
    }

    metadata = parse_ffprobe_payload("A001.mov", payload)

    assert metadata.width == 4096
    assert metadata.height == 2160
    assert metadata.bit_depth == 10
    assert metadata.frame_rate == pytest.approx(24000 / 1001)
    assert metadata.camera_make == "ARRI"
    assert metadata.camera_model == "ALEXA 35"
    assert metadata.tags["gamma"] == "ARRI LogC4"


def test_parsed_camera_metadata_feeds_existing_aces_resolver():
    metadata = parse_ffprobe_payload(
        "A001.mov",
        {
            "streams": [
                {
                    "codec_type": "video",
                    "codec_name": "prores",
                    "tags": {"make": "ARRI", "gamma": "LogC4"},
                }
            ],
            "format": {"format_name": "mov"},
        },
    )

    match = resolve_media_camera_color(metadata)
    assert match.source_space == "ARRI LogC4"
    assert match.rule == "arri-logc4"


def test_probe_rejects_missing_asset(tmp_path: Path):
    with pytest.raises(MediaProbeFailedError, match="does not exist"):
        probe_media_metadata(tmp_path / "missing.mov")


def test_frame_rate_zero_fraction_becomes_none():
    metadata = parse_ffprobe_payload(
        "still.mxf",
        {
            "streams": [{"codec_type": "video", "avg_frame_rate": "0/0"}],
            "format": {},
        },
    )
    assert metadata.frame_rate is None
