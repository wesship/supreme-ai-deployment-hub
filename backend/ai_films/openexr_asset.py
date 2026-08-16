from __future__ import annotations

from dataclasses import dataclass
from pathlib import Path
from typing import Any, Mapping, Sequence

EXR_MAGIC = b"\x76\x2f\x31\x01"
EXR_EXTENSIONS = {".exr"}
EXR_MIME_TYPES = {"image/x-exr", "image/exr"}
REQUIRED_RGB_CHANNELS = ("R", "G", "B")


class OpenEXRError(RuntimeError):
    """Base error for AI FILMS OpenEXR asset handling."""


class OpenEXRDependencyError(OpenEXRError):
    """Raised when the OpenEXR Python bindings are unavailable."""


class OpenEXRValidationError(OpenEXRError):
    """Raised when an asset cannot satisfy the AI FILMS OpenEXR policy."""


@dataclass(frozen=True)
class OpenEXRAssetInfo:
    path: str
    width: int
    height: int
    channels: tuple[str, ...]
    compression: str | None
    line_order: str | None
    data_window: tuple[int, int, int, int]
    display_window: tuple[int, int, int, int]
    has_rgb: bool
    has_alpha: bool
    has_depth: bool
    multipart: bool
    deep: bool
    metadata: dict[str, Any]


def _load_bindings():
    try:
        import OpenEXR  # type: ignore
    except ImportError as exc:
        raise OpenEXRDependencyError(
            "OpenEXR runtime support is unavailable. Install requirements.txt "
            "so the OpenEXR Python bindings are present."
        ) from exc
    return OpenEXR


def has_exr_extension(path: str | Path) -> bool:
    return Path(path).suffix.lower() in EXR_EXTENSIONS


def has_exr_magic(path: str | Path) -> bool:
    with Path(path).open("rb") as stream:
        return stream.read(4) == EXR_MAGIC


def validate_exr_identity(path: str | Path) -> Path:
    candidate = Path(path)
    if not has_exr_extension(candidate):
        raise OpenEXRValidationError(f"Expected .exr asset, received: {candidate.name}")
    if not candidate.is_file():
        raise OpenEXRValidationError(f"OpenEXR asset does not exist: {candidate}")
    if not has_exr_magic(candidate):
        raise OpenEXRValidationError(f"Invalid OpenEXR magic bytes: {candidate}")
    return candidate


def _box_tuple(box: Any) -> tuple[int, int, int, int]:
    """Normalize legacy Imath boxes and OpenEXR.File tuple boxes."""
    if hasattr(box, "min") and hasattr(box, "max"):
        return (int(box.min.x), int(box.min.y), int(box.max.x), int(box.max.y))
    minimum, maximum = box
    return (int(minimum[0]), int(minimum[1]), int(maximum[0]), int(maximum[1]))


def _safe_text(value: Any) -> str | None:
    if value is None:
        return None
    name = getattr(value, "name", None)
    return str(name if name is not None else value)


def inspect_exr(path: str | Path, *, require_rgb: bool = True) -> OpenEXRAssetInfo:
    candidate = validate_exr_identity(path)
    OpenEXR = _load_bindings()

    with OpenEXR.File(str(candidate), separate_channels=True) as input_file:
        header = input_file.header()
        channels_map = input_file.channels()
        channels = tuple(sorted(str(name) for name in channels_map.keys()))
        data_window = header["dataWindow"]
        display_window = header.get("displayWindow", data_window)
        min_x, min_y, max_x, max_y = _box_tuple(data_window)
        width = max_x - min_x + 1
        height = max_y - min_y + 1
        channel_set = set(channels)
        has_rgb = all(channel in channel_set for channel in REQUIRED_RGB_CHANNELS)
        has_alpha = "A" in channel_set
        has_depth = any(channel in channel_set for channel in ("Z", "depth", "Depth"))

        if require_rgb and not has_rgb:
            raise OpenEXRValidationError(
                f"AI FILMS master EXR requires R/G/B channels; found {channels or 'none'}"
            )

        multipart = len(input_file.parts) > 1
        storage = header.get("type")
        deep = storage in {OpenEXR.deepscanline, OpenEXR.deeptile}

        metadata = {
            key: value
            for key, value in header.items()
            if key not in {"channels", "dataWindow", "displayWindow"}
            and isinstance(value, (str, int, float, bool))
        }

        return OpenEXRAssetInfo(
            path=str(candidate),
            width=width,
            height=height,
            channels=channels,
            compression=_safe_text(header.get("compression")),
            line_order=_safe_text(header.get("lineOrder")),
            data_window=_box_tuple(data_window),
            display_window=_box_tuple(display_window),
            has_rgb=has_rgb,
            has_alpha=has_alpha,
            has_depth=has_depth,
            multipart=multipart,
            deep=deep,
            metadata=metadata,
        )


def validate_master_exr(
    path: str | Path,
    *,
    expected_width: int | None = None,
    expected_height: int | None = None,
    require_depth: bool = False,
) -> OpenEXRAssetInfo:
    info = inspect_exr(path, require_rgb=True)
    if expected_width is not None and info.width != expected_width:
        raise OpenEXRValidationError(
            f"Master EXR width {info.width} does not match expected {expected_width}"
        )
    if expected_height is not None and info.height != expected_height:
        raise OpenEXRValidationError(
            f"Master EXR height {info.height} does not match expected {expected_height}"
        )
    if require_depth and not info.has_depth:
        raise OpenEXRValidationError("Master EXR is missing a required depth channel")
    return info


def write_rgb_exr(
    path: str | Path,
    *,
    width: int,
    height: int,
    red: Sequence[float],
    green: Sequence[float],
    blue: Sequence[float],
    alpha: Sequence[float] | None = None,
    depth: Sequence[float] | None = None,
    metadata: Mapping[str, str | int | float] | None = None,
) -> Path:
    if width <= 0 or height <= 0:
        raise OpenEXRValidationError("OpenEXR width and height must be positive")
    pixel_count = width * height
    channel_values: dict[str, Sequence[float]] = {"R": red, "G": green, "B": blue}
    if alpha is not None:
        channel_values["A"] = alpha
    if depth is not None:
        channel_values["Z"] = depth
    for name, values in channel_values.items():
        if len(values) != pixel_count:
            raise OpenEXRValidationError(
                f"Channel {name} contains {len(values)} pixels; expected {pixel_count}"
            )

    try:
        import numpy as np
    except ImportError as exc:
        raise OpenEXRDependencyError("NumPy is required to write OpenEXR assets") from exc

    OpenEXR = _load_bindings()
    target = Path(path)
    if not has_exr_extension(target):
        raise OpenEXRValidationError("OpenEXR output path must use the .exr extension")
    target.parent.mkdir(parents=True, exist_ok=True)

    header: dict[str, Any] = {
        "type": OpenEXR.scanlineimage,
        "compression": OpenEXR.ZIP_COMPRESSION,
        "aiFilmsWorkingSpace": "ACEScg",
        "aiFilmsMasterContainer": "OpenEXR",
    }
    for key, value in (metadata or {}).items():
        header[str(key)] = str(value)

    pixels: dict[str, Any] = {
        "R": np.asarray(red, dtype=np.float16).reshape(height, width),
        "G": np.asarray(green, dtype=np.float16).reshape(height, width),
        "B": np.asarray(blue, dtype=np.float16).reshape(height, width),
    }
    if alpha is not None:
        pixels["A"] = np.asarray(alpha, dtype=np.float16).reshape(height, width)
    if depth is not None:
        pixels["Z"] = np.asarray(depth, dtype=np.float32).reshape(height, width)

    with OpenEXR.File(header, pixels) as output:
        output.write(str(target))

    validate_master_exr(
        target,
        expected_width=width,
        expected_height=height,
        require_depth=depth is not None,
    )
    return target
