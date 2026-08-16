from __future__ import annotations

from dataclasses import dataclass
from pathlib import Path
import re
from typing import Mapping, Sequence

from backend.ai_films.color_management import ACESCG, write_color_managed_exr

ACES_2_STUDIO_CONFIG = "studio-config-v4.0.0_aces-v2.0_ocio-v2.5"


class CameraColorError(RuntimeError):
    """Base error for camera/input color-space resolution."""


class CameraColorAmbiguityError(CameraColorError):
    """Raised when metadata is recognizable but not specific enough for a safe transform."""


class UnsupportedCameraColorError(CameraColorError):
    """Raised when no supported input color-space can be resolved."""


@dataclass(frozen=True)
class CameraColorMatch:
    source_space: str
    config_name: str
    rule: str
    normalized_hint: str


def _normalize(value: object) -> str:
    text = str(value or "").lower()
    return re.sub(r"[^a-z0-9]+", " ", text).strip()


def _contains(text: str, *tokens: str) -> bool:
    return all(_normalize(token) in text for token in tokens)


def resolve_camera_color_space(*hints: object) -> CameraColorMatch:
    """Resolve common camera/log metadata to an ACES 2 Studio input color space.

    The resolver is intentionally conservative for combinations where the transfer curve
    alone does not identify the gamut. For example, bare Sony S-Log3 is rejected unless
    an S-Gamut variant is also present.
    """

    normalized = " ".join(part for part in (_normalize(hint) for hint in hints) if part)
    if not normalized:
        raise UnsupportedCameraColorError("No camera color metadata was provided")

    rules: tuple[tuple[str, str, tuple[str, ...]], ...] = (
        ("ARRI LogC4", "arri-logc4", ("arri", "logc4")),
        ("ARRI LogC3 (EI800)", "arri-logc3-ei800", ("arri", "logc3")),
        ("BMDFilm WideGamut Gen5", "blackmagic-film-gen5", ("blackmagic", "gen5")),
        ("BMDFilm WideGamut Gen5", "bmd-film-gen5", ("bmd", "gen5")),
        ("DaVinci Intermediate WideGamut", "davinci-intermediate", ("davinci", "intermediate")),
        ("CanonLog2 CinemaGamut D55", "canon-log2-cinema-gamut", ("canon", "log2", "cinema")),
        ("CanonLog2 CinemaGamut D55", "canon-clog2-cinema-gamut", ("clog2", "cinema")),
        ("CanonLog3 CinemaGamut D55", "canon-log3-cinema-gamut", ("canon", "log3", "cinema")),
        ("CanonLog3 CinemaGamut D55", "canon-clog3-cinema-gamut", ("clog3", "cinema")),
        ("V-Log V-Gamut", "panasonic-vlog", ("panasonic", "v log")),
        ("V-Log V-Gamut", "vlog-vgamut", ("v log", "v gamut")),
        ("Log3G10 REDWideGamutRGB", "red-log3g10", ("log3g10",)),
        ("S-Log3 Venice S-Gamut3.Cine", "sony-venice-slog3-sgamut3cine", ("s log3", "venice", "s gamut3 cine")),
        ("S-Log3 Venice S-Gamut3", "sony-venice-slog3-sgamut3", ("s log3", "venice", "s gamut3")),
        ("S-Log3 S-Gamut3.Cine", "sony-slog3-sgamut3cine", ("s log3", "s gamut3 cine")),
        ("S-Log3 S-Gamut3", "sony-slog3-sgamut3", ("s log3", "s gamut3")),
        ("Apple Log", "apple-log", ("apple", "log")),
        ("Camera Rec.709", "camera-rec709", ("rec 709",)),
        ("Camera Rec.709", "camera-bt709", ("bt709",)),
        ("sRGB Encoded Rec.709 (sRGB)", "srgb", ("srgb",)),
        (ACESCG, "acescg", ("acescg",)),
    )

    for source_space, rule, tokens in rules:
        if _contains(normalized, *tokens):
            return CameraColorMatch(
                source_space=source_space,
                config_name=ACES_2_STUDIO_CONFIG,
                rule=rule,
                normalized_hint=normalized,
            )

    if "s log3" in normalized:
        raise CameraColorAmbiguityError(
            "Sony S-Log3 requires an S-Gamut3, S-Gamut3.Cine, or Venice gamut hint"
        )
    if "canon" in normalized and ("log2" in normalized or "log3" in normalized):
        raise CameraColorAmbiguityError(
            "Canon Log input requires a Cinema Gamut hint for the supported ACES transform"
        )

    raise UnsupportedCameraColorError(
        f"Unsupported camera/input color metadata: {normalized}"
    )


def infer_camera_color_from_metadata(
    metadata: Mapping[str, object],
    *,
    filename: str | Path | None = None,
) -> CameraColorMatch:
    """Flatten relevant metadata values and resolve a supported source color space."""

    hints: list[object] = []
    for key, value in metadata.items():
        hints.extend((key, value))
    if filename is not None:
        hints.append(Path(filename).name)
    return resolve_camera_color_space(*hints)


def write_camera_managed_exr(
    path: str | Path,
    *,
    width: int,
    height: int,
    red: Sequence[float],
    green: Sequence[float],
    blue: Sequence[float],
    metadata: Mapping[str, object],
    filename: str | Path | None = None,
    alpha: Sequence[float] | None = None,
    depth: Sequence[float] | None = None,
) -> Path:
    """Resolve camera metadata, transform through ACES 2 Studio to ACEScg, and write EXR."""

    match = infer_camera_color_from_metadata(metadata, filename=filename)
    return write_color_managed_exr(
        path,
        width=width,
        height=height,
        red=red,
        green=green,
        blue=blue,
        source_space=match.source_space,
        alpha=alpha,
        depth=depth,
        config_name=match.config_name,
    )
