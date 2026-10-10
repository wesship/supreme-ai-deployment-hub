from pathlib import Path

import pytest

from backend.ai_films.openexr_asset import (
    EXR_MAGIC,
    OpenEXRValidationError,
    has_exr_extension,
    has_exr_magic,
    inspect_exr,
    validate_exr_identity,
    validate_master_exr,
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


def test_openexr_round_trip_preserves_master_contract(tmp_path: Path):
    width = 3
    height = 2
    pixel_count = width * height
    target = tmp_path / "roundtrip.exr"

    write_rgb_exr(
        target,
        width=width,
        height=height,
        red=[0.125] * pixel_count,
        green=[0.25] * pixel_count,
        blue=[0.5] * pixel_count,
        alpha=[1.0] * pixel_count,
        depth=[2.0] * pixel_count,
        metadata={"shotId": "SS-RT-001", "frame": 42},
    )

    info = inspect_exr(target)
    assert info.width == width
    assert info.height == height
    assert info.has_rgb is True
    assert info.has_alpha is True
    assert info.has_depth is True
    assert set(("R", "G", "B", "A", "Z")).issubset(info.channels)
    assert info.metadata["aiFilmsWorkingSpace"] == "ACEScg"
    assert info.metadata["aiFilmsMasterContainer"] == "OpenEXR"
    assert info.metadata["shotId"] == "SS-RT-001"
    assert info.metadata["frame"] == "42"

    validated = validate_master_exr(
        target,
        expected_width=width,
        expected_height=height,
        require_depth=True,
    )
    assert validated == info


def test_master_validation_rejects_dimension_mismatch(tmp_path: Path):
    target = tmp_path / "dimension-check.exr"
    write_rgb_exr(
        target,
        width=1,
        height=1,
        red=[0.0],
        green=[0.0],
        blue=[0.0],
    )

    with pytest.raises(OpenEXRValidationError, match="width"):
        validate_master_exr(target, expected_width=2)
