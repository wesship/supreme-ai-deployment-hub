from pathlib import Path
from unittest.mock import patch

import pytest

from backend.ai_films.frame_sequence import (
    FrameDecodeError,
    FrameDecoderUnavailableError,
    decode_to_acescg_exr_sequence,
)
from backend.ai_films.media_metadata import MediaMetadata


def _metadata(path: Path) -> MediaMetadata:
    return MediaMetadata(
        path=str(path),
        format_name="mov,mp4,m4a,3gp,3g2,mj2",
        duration_seconds=1.0,
        bit_rate=1_000_000,
        width=2,
        height=2,
        codec_name="prores",
        codec_long_name="Apple ProRes",
        pixel_format="yuv422p10le",
        bit_depth=10,
        frame_rate=24.0,
        color_range="tv",
        color_space=None,
        color_transfer=None,
        color_primaries=None,
        camera_make="ARRI",
        camera_model="ALEXA 35",
        tags={"gamma": "LogC4", "gamut": "Wide Gamut 4"},
        raw_probe={},
    )


def test_missing_source_fails_before_ffmpeg(tmp_path: Path) -> None:
    with pytest.raises(FrameDecodeError, match="does not exist"):
        decode_to_acescg_exr_sequence(tmp_path / "missing.mov", tmp_path / "frames")


def test_missing_ffmpeg_is_typed(tmp_path: Path) -> None:
    source = tmp_path / "clip.mov"
    source.write_bytes(b"media")
    with patch("backend.ai_films.frame_sequence.shutil.which", return_value=None):
        with pytest.raises(FrameDecoderUnavailableError, match="ffmpeg executable not found"):
            decode_to_acescg_exr_sequence(source, tmp_path / "frames", metadata=_metadata(source))


def test_invalid_start_number_is_rejected(tmp_path: Path) -> None:
    source = tmp_path / "clip.mov"
    source.write_bytes(b"media")
    with pytest.raises(Exception, match="start_number"):
        decode_to_acescg_exr_sequence(
            source,
            tmp_path / "frames",
            metadata=_metadata(source),
            start_number=-1,
        )
