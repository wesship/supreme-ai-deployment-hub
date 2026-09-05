from unittest.mock import patch

import numpy as np
import pytest

from backend.ai_films.color_management import transform_rgb


class _IdentityProcessor:
    def applyRGB(self, packed) -> None:
        return None


def test_transform_rgb_accepts_numpy_channel_arrays() -> None:
    red = np.array([0.1, 0.2], dtype=np.float32)
    green = np.array([0.3, 0.4], dtype=np.float32)
    blue = np.array([0.5, 0.6], dtype=np.float32)

    with patch(
        "backend.ai_films.color_management.get_cpu_processor",
        return_value=_IdentityProcessor(),
    ):
        transformed = transform_rgb(
            red,
            green,
            blue,
            source_space="ARRI LogC4",
            destination_space="ACEScg",
        )

    assert transformed[0] == pytest.approx(red.tolist())
    assert transformed[1] == pytest.approx(green.tolist())
    assert transformed[2] == pytest.approx(blue.tolist())


def test_transform_rgb_accepts_empty_numpy_channel_arrays() -> None:
    empty = np.array([], dtype=np.float32)

    transformed = transform_rgb(
        empty,
        empty,
        empty,
        source_space="ARRI LogC4",
        destination_space="ACEScg",
    )

    assert transformed == ([], [], [])
