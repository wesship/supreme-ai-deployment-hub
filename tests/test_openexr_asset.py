from pathlib import Path

import pytest

from backend.ai_films.openexr_asset import (
    EXR_MAGIC,
    OpenEXRValidationError,
    has_exr_extension,
    has_exr_magic,
    validate_exr_identity,
    write_rgb_exr,
)


def test_exr_extension_is_case_insensitive():
    assert has_exr_extension("frame.exr")
    assert has_exr_extension("FRAME.EXR")
    assert not has_exr_extension("frame.png")


def test_magic_detection_and_identity_validation(tmp_path: Path):
    asset = tmp_path / "master.exr"
    asset.write_bytes(EXR_MAGIC + b"test")
    assert has_exr_magic(asset)
    assert validate_exr_identity(asset) == asset


def test_identity_rejects_wrong_extension(tmp_path: Path):
    asset = tmp_path / "master.bin"
    asset.write_bytes(EXR_MAGIC + b"test")
    with pytest.raises(OpenEXRValidationError):
        validate_exr_identity(asset)


def test_identity_rejects_fake_exr(tmp_path: Path):
    asset = tmp_path / "master.exr"
    asset.write_bytes(b"not-an-exr")
    with pytest.raises(OpenEXRValidationError):
        validate_exr_identity(asset)


def test_writer_validates_channel_lengths_before_runtime_dependency(tmp_path: Path):
    with pytest.raises(OpenEXRValidationError):
        write_rgb_exr(
            tmp_path / "master.exr",
            width=2,
            height=2,
            red=[0.0],
            green=[0.0] * 4,
            blue=[0.0] * 4,
        )
