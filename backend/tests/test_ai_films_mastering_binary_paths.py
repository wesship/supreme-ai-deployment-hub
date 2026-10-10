from backend.ai_films.mastering_worker import _media_binaries


def test_mastering_binary_paths_default_to_system_locations(monkeypatch):
    monkeypatch.delenv("AI_FILM_FFMPEG_BINARY", raising=False)
    monkeypatch.delenv("AI_FILM_FFPROBE_BINARY", raising=False)

    ffmpeg, ffprobe = _media_binaries()

    assert ffmpeg == "/usr/bin/ffmpeg"
    assert ffprobe == "/usr/bin/ffprobe"


def test_mastering_binary_paths_allow_explicit_overrides(monkeypatch):
    monkeypatch.setenv("AI_FILM_FFMPEG_BINARY", "/opt/media/ffmpeg")
    monkeypatch.setenv("AI_FILM_FFPROBE_BINARY", "/opt/media/ffprobe")

    ffmpeg, ffprobe = _media_binaries()

    assert ffmpeg == "/opt/media/ffmpeg"
    assert ffprobe == "/opt/media/ffprobe"
