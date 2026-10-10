from pathlib import Path

import pytest

from backend.ai_films.assembly_tracks import write_srt
from backend.ai_films.director_router import (
    DirectorAssemblyRequest,
    DirectorAudioTrack,
    DirectorClip,
    DirectorSubtitleCue,
)


def test_write_srt_formats_valid_timing(tmp_path: Path):
    target = tmp_path / "captions.srt"
    write_srt(
        [
            {"start": 1.25, "end": 3.5, "text": "The signal was never lost."},
            {"start": 4.0, "end": 5.125, "text": "It was waiting."},
        ],
        target,
    )
    text = target.read_text()
    assert "00:00:01,250 --> 00:00:03,500" in text
    assert "The signal was never lost." in text
    assert "00:00:04,000 --> 00:00:05,125" in text


def test_director_accepts_registered_audio_and_subtitle_tracks():
    request = DirectorAssemblyRequest(
        project_id="project-1",
        title="Picture Lock",
        clips=[
            DirectorClip(
                asset_id="video-1",
                label="Scene 1",
                duration_seconds=10,
                source_out=5,
            )
        ],
        audio_tracks=[
            DirectorAudioTrack(
                asset_id="voice-asset",
                kind="dialogue",
                timeline_start=1.0,
                source_in=0,
                source_out=2.5,
                gain_db=-3,
            ),
            DirectorAudioTrack(
                asset_id="score-asset",
                kind="music",
                timeline_start=0,
                gain_db=-12,
            ),
        ],
        subtitle_cues=[
            DirectorSubtitleCue(start=1.0, end=3.5, text="The signal was never lost.")
        ],
    )
    assert len(request.audio_tracks) == 2
    assert request.audio_tracks[0].kind == "dialogue"
    assert request.subtitle_cues[0].end == 3.5


def test_director_rejects_invalid_audio_and_subtitle_ranges():
    with pytest.raises(ValueError):
        DirectorAudioTrack(
            asset_id="voice-asset",
            kind="dialogue",
            source_in=3,
            source_out=2,
        )
    with pytest.raises(ValueError):
        DirectorSubtitleCue(start=5, end=4, text="bad")
