from pathlib import Path

import pytest

from backend.ai_films.color_management import (
    ACESCG,
    ACES_2_CG_CONFIG,
    ColorManagementError,
    ColorSpaceError,
    inspect_transform,
    list_color_spaces,
    transform_rgb,
    transform_to_acescg,
)


def test_builtin_aces2_cg_config_contains_acescg():
    spaces = list_color_spaces()
    assert ACESCG in spaces


def test_acescg_identity_processor_is_noop():
    info = inspect_transform(ACESCG, ACESCG)
    assert info.config_name == ACES_2_CG_CONFIG
    assert info.source_space == ACESCG
    assert info.destination_space == ACESCG
    assert info.noop is True
    assert info.processor_cache_id


def test_identity_transform_preserves_rgb_values():
    red = [0.0, 0.25, 1.0]
    green = [0.1, 0.5, 0.9]
    blue = [0.2, 0.75, 0.8]

    r_out, g_out, b_out = transform_to_acescg(
        red,
        green,
        blue,
        source_space=ACESCG,
    )

    assert r_out == pytest.approx(red, abs=1e-7)
    assert g_out == pytest.approx(green, abs=1e-7)
    assert b_out == pytest.approx(blue, abs=1e-7)


def test_transform_rejects_mismatched_channel_lengths():
    with pytest.raises(ColorManagementError, match="RGB channel lengths must match"):
        transform_rgb(
            [0.0],
            [0.0, 1.0],
            [0.0],
            source_space=ACESCG,
            destination_space=ACESCG,
        )


def test_unknown_color_space_is_rejected():
    with pytest.raises(ColorSpaceError, match="Unknown color space"):
        inspect_transform("NOT_A_REAL_COLOR_SPACE", ACESCG)


def test_empty_rgb_transform_is_supported_without_loading_processor():
    assert transform_rgb(
        [],
        [],
        [],
        source_space=ACESCG,
        destination_space=ACESCG,
    ) == ([], [], [])
