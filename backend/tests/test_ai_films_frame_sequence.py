from io import BytesIO
from pathlib import Path
import struct
from unittest.mock import MagicMock, patch

import pytest

from backend.ai_films.frame_sequence import (
    FrameDecodeError,
    FrameDecoderUnavailableError,
    _resolve_media_binary,
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
    with (
        patch("backend.ai_films.frame_sequence.shutil.which", return_value=None),
        patch("backend.ai_films.frame_sequence.Path.is_file", return_value=False),
    ):
        with pytest.raises(FrameDecoderUnavailableError, match="ffmpeg executable not found"):
            decode_to_acescg_exr_sequence(source, tmp_path / "frames", metadata=_metadata(source))


def test_resolver_falls_back_to_usr_bin_when_path_lookup_fails() -> None:
    def is_file(candidate: Path) -> bool:
        return str(candidate) == "/usr/bin/ffmpeg"

    with (
        patch("backend.ai_films.frame_sequence.shutil.which", return_value=None),
        patch("backend.ai_films.frame_sequence.Path.is_file", autospec=True, side_effect=is_file),
        patch("backend.ai_films.frame_sequence.os.access", return_value=True),
    ):
        assert _resolve_media_binary("ffmpeg") == "/usr/bin/ffmpeg"


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


def test_decoder_uses_camera_match_source_space(tmp_path: Path) -> None:
    source = tmp_path / "clip.mov"
    source.write_bytes(b"media")

    process = MagicMock()
    process.stdout = BytesIO(struct.pack("<12f", *([0.5] * 12)))
    process.stderr = BytesIO()
    process.wait.return_value = 0
    process.poll.return_value = 0

    with (
        patch("backend.ai_films.frame_sequence._resolve_media_binary", return_value="/usr/bin/ffmpeg"),
        patch("backend.ai_films.frame_sequence.probe_frame_timestamps", return_value=(0.0,)),
        patch("backend.ai_films.frame_sequence.subprocess.Popen", return_value=process),
        patch("backend.ai_films.frame_sequence.write_color_managed_exr") as write_exr,
        patch("backend.ai_films.frame_sequence.build_editorial_conform_manifest", return_value=object()),
        patch(
            "backend.ai_films.frame_sequence.write_editorial_manifest",
            return_value=tmp_path / "frames" / "editorial_conform.json",
        ),
        patch(
            "backend.ai_films.frame_sequence.write_otio_timeline",
            return_value=tmp_path / "frames" / "editorial_conform.otio",
        ),
    ):
        manifest = decode_to_acescg_exr_sequence(
            source,
            tmp_path / "frames",
            metadata=_metadata(source),
        )

    assert manifest.source_color_space == "ARRI LogC4"
    assert write_exr.call_args.kwargs["source_space"] == "ARRI LogC4"
    assert write_exr.call_args.kwargs["config_name"] == "studio-config-v4.0.0_aces-v2.0_ocio-v2.5"
