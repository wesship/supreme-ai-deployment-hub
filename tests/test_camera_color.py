import pytest

from backend.ai_films.camera_color import (
    ACES_2_STUDIO_CONFIG,
    CameraColorAmbiguityError,
    UnsupportedCameraColorError,
    infer_camera_color_from_metadata,
    resolve_camera_color_space,
)
from backend.ai_films.color_management import ACESCG, inspect_transform, list_color_spaces


@pytest.mark.parametrize(
    ("hints", "expected"),
    [
        (("ARRI Alexa 35", "LogC4"), "ARRI LogC4"),
        (("ARRI Alexa", "LogC3"), "ARRI LogC3 (EI800)"),
        (("Blackmagic Pocket 6K", "Film Gen5"), "BMDFilm WideGamut Gen5"),
        (("DaVinci Wide Gamut", "Intermediate"), "DaVinci Intermediate WideGamut"),
        (("Canon", "CLog2 Cinema Gamut"), "CanonLog2 CinemaGamut D55"),
        (("Canon", "CLog3 Cinema Gamut"), "CanonLog3 CinemaGamut D55"),
        (("Panasonic GH6", "V-Log"), "V-Log V-Gamut"),
        (("RED V-RAPTOR", "Log3G10 REDWideGamutRGB"), "Log3G10 REDWideGamutRGB"),
        (("Sony FX6", "S-Log3 S-Gamut3.Cine"), "S-Log3 S-Gamut3.Cine"),
        (("Sony Venice 2", "S-Log3 S-Gamut3.Cine"), "S-Log3 Venice S-Gamut3.Cine"),
        (("Apple iPhone", "Apple Log"), "Apple Log"),
        (("Camera", "Rec.709"), "Camera Rec.709"),
        (("ffprobe", "color_space bt709 color_transfer bt709 color_primaries bt709"), "Camera Rec.709"),
        (("web image", "sRGB"), "sRGB Encoded Rec.709 (sRGB)"),
        (("render", "ACEScg"), ACESCG),
    ],
)
def test_resolves_supported_camera_inputs(hints, expected):
    match = resolve_camera_color_space(*hints)
    assert match.source_space == expected
    assert match.config_name == ACES_2_STUDIO_CONFIG
    assert match.rule


def test_studio_config_contains_camera_spaces_and_builds_acescg_processor():
    spaces = list_color_spaces(ACES_2_STUDIO_CONFIG)
    for name in (
        "ARRI LogC4",
        "BMDFilm WideGamut Gen5",
        "Log3G10 REDWideGamutRGB",
        "S-Log3 S-Gamut3.Cine",
        "V-Log V-Gamut",
        "Apple Log",
        ACESCG,
    ):
        assert name in spaces

    info = inspect_transform(
        "ARRI LogC4",
        ACESCG,
        config_name=ACES_2_STUDIO_CONFIG,
    )
    assert info.noop is False
    assert info.processor_cache_id


def test_bare_slog3_is_rejected_as_ambiguous():
    with pytest.raises(CameraColorAmbiguityError, match="S-Gamut3"):
        resolve_camera_color_space("Sony FX3 S-Log3")


def test_canon_log_without_cinema_gamut_is_rejected_as_ambiguous():
    with pytest.raises(CameraColorAmbiguityError, match="Cinema Gamut"):
        resolve_camera_color_space("Canon CLog3")


def test_unknown_input_is_rejected():
    with pytest.raises(UnsupportedCameraColorError, match="Unsupported"):
        resolve_camera_color_space("mystery camera profile")


def test_metadata_flattening_resolves_camera_and_profile():
    match = infer_camera_color_from_metadata(
        {
            "camera_make": "Sony",
            "camera_model": "FX6",
            "gamma": "S-Log3",
            "gamut": "S-Gamut3.Cine",
        },
        filename="A001_C001.mov",
    )
    assert match.source_space == "S-Log3 S-Gamut3.Cine"


def test_ffprobe_bt709_metadata_resolves_rec709():
    match = infer_camera_color_from_metadata(
        {
            "color_space": "bt709",
            "color_transfer": "bt709",
            "color_primaries": "bt709",
            "color_range": "tv",
        },
        filename="canary.mp4",
    )
    assert match.source_space == "Camera Rec.709"
    assert match.rule == "camera-bt709"
