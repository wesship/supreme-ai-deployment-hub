from __future__ import annotations

from dataclasses import dataclass
from pathlib import Path
from typing import Mapping, Sequence

from backend.ai_films.openexr_asset import write_rgb_exr

ACESCG = "ACEScg"
ACES_2_CG_CONFIG = "cg-config-v4.0.0_aces-v2.0_ocio-v2.5"


class ColorManagementError(RuntimeError):
    """Base error for AI FILMS color-management operations."""


class ColorManagementDependencyError(ColorManagementError):
    """Raised when the OpenColorIO Python bindings are unavailable."""


class ColorSpaceError(ColorManagementError):
    """Raised when an OCIO color space or transform cannot be resolved."""


@dataclass(frozen=True)
class ColorTransformInfo:
    config_name: str
    source_space: str
    destination_space: str
    processor_cache_id: str
    noop: bool


def _load_ocio():
    try:
        import PyOpenColorIO as ocio  # type: ignore
    except ImportError as exc:
        raise ColorManagementDependencyError(
            "OpenColorIO runtime support is unavailable. Install requirements.txt "
            "so the PyOpenColorIO bindings are present."
        ) from exc
    return ocio


def load_aces_config(config_name: str = ACES_2_CG_CONFIG):
    ocio = _load_ocio()
    try:
        config = ocio.Config.CreateFromBuiltinConfig(config_name)
    except Exception as exc:
        raise ColorManagementError(
            f"Unable to load built-in OpenColorIO config: {config_name}"
        ) from exc
    try:
        config.validate()
    except Exception as exc:
        raise ColorManagementError(
            f"OpenColorIO config failed validation: {config_name}"
        ) from exc
    return config


def list_color_spaces(config_name: str = ACES_2_CG_CONFIG) -> tuple[str, ...]:
    config = load_aces_config(config_name)
    return tuple(str(name) for name in config.getColorSpaceNames())


def _require_color_space(config, color_space: str) -> None:
    try:
        resolved = config.getColorSpace(color_space)
    except Exception as exc:
        raise ColorSpaceError(f"Unable to resolve color space: {color_space}") from exc
    if resolved is None:
        raise ColorSpaceError(f"Unknown color space: {color_space}")


def get_cpu_processor(
    source_space: str,
    destination_space: str,
    *,
    config_name: str = ACES_2_CG_CONFIG,
):
    config = load_aces_config(config_name)
    _require_color_space(config, source_space)
    _require_color_space(config, destination_space)
    try:
        processor = config.getProcessor(source_space, destination_space)
        return processor.getDefaultCPUProcessor()
    except Exception as exc:
        raise ColorManagementError(
            f"Unable to build OCIO processor: {source_space} -> {destination_space}"
        ) from exc


def inspect_transform(
    source_space: str,
    destination_space: str,
    *,
    config_name: str = ACES_2_CG_CONFIG,
) -> ColorTransformInfo:
    cpu = get_cpu_processor(source_space, destination_space, config_name=config_name)
    return ColorTransformInfo(
        config_name=config_name,
        source_space=source_space,
        destination_space=destination_space,
        processor_cache_id=str(cpu.getCacheID()),
        noop=bool(cpu.isNoOp()),
    )


def transform_rgb(
    red: Sequence[float],
    green: Sequence[float],
    blue: Sequence[float],
    *,
    source_space: str,
    destination_space: str,
    config_name: str = ACES_2_CG_CONFIG,
) -> tuple[list[float], list[float], list[float]]:
    if not (len(red) == len(green) == len(blue)):
        raise ColorManagementError("RGB channel lengths must match")
    if not red:
        return [], [], []
    try:
        import numpy as np
    except ImportError as exc:
        raise ColorManagementDependencyError("NumPy is required for OpenColorIO image processing") from exc
    packed = np.empty((len(red), 3), dtype=np.float32)
    packed[:, 0] = np.asarray(red, dtype=np.float32)
    packed[:, 1] = np.asarray(green, dtype=np.float32)
    packed[:, 2] = np.asarray(blue, dtype=np.float32)
    cpu = get_cpu_processor(source_space, destination_space, config_name=config_name)
    try:
        cpu.applyRGB(packed)
    except Exception as exc:
        raise ColorManagementError(
            f"OCIO RGB transform failed: {source_space} -> {destination_space}"
        ) from exc
    return (
        packed[:, 0].astype(float).tolist(),
        packed[:, 1].astype(float).tolist(),
        packed[:, 2].astype(float).tolist(),
    )


def transform_to_acescg(
    red: Sequence[float],
    green: Sequence[float],
    blue: Sequence[float],
    *,
    source_space: str,
    config_name: str = ACES_2_CG_CONFIG,
) -> tuple[list[float], list[float], list[float]]:
    return transform_rgb(
        red,
        green,
        blue,
        source_space=source_space,
        destination_space=ACESCG,
        config_name=config_name,
    )


def write_color_managed_exr(
    path: str | Path,
    *,
    width: int,
    height: int,
    red: Sequence[float],
    green: Sequence[float],
    blue: Sequence[float],
    source_space: str,
    alpha: Sequence[float] | None = None,
    depth: Sequence[float] | None = None,
    config_name: str = ACES_2_CG_CONFIG,
    metadata: Mapping[str, str | int | float] | None = None,
) -> Path:
    """Transform source RGB into ACEScg and preserve caller provenance in the EXR."""
    red_aces, green_aces, blue_aces = transform_to_acescg(
        red,
        green,
        blue,
        source_space=source_space,
        config_name=config_name,
    )
    exr_metadata: dict[str, str | int | float] = {
        "aiFilmsSourceColorSpace": source_space,
        "aiFilmsOCIOConfig": config_name,
        "aiFilmsColorTransform": f"{source_space}->{ACESCG}",
    }
    exr_metadata.update(metadata or {})
    return write_rgb_exr(
        path,
        width=width,
        height=height,
        red=red_aces,
        green=green_aces,
        blue=blue_aces,
        alpha=alpha,
        depth=depth,
        metadata=exr_metadata,
    )
