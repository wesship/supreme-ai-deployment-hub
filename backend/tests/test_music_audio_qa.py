"""Focused validation for the Music Studio audio QA primitives."""
from __future__ import annotations

import asyncio
import tempfile
import unittest
from pathlib import Path

from backend.music import audio_qa


class MusicAudioQaTests(unittest.IsolatedAsyncioTestCase):
    async def _ffmpeg(self, *arguments: str) -> None:
        process = await asyncio.create_subprocess_exec("ffmpeg", "-y", "-hide_banner", *arguments)
        exit_code = await process.wait()
        self.assertEqual(exit_code, 0)

    async def test_probe_volume_and_silence_on_audible_clip(self) -> None:
        with tempfile.TemporaryDirectory() as temporary_directory:
            audio_path = Path(temporary_directory) / "tone.wav"
            await self._ffmpeg(
                "-f", "lavfi",
                "-i", "sine=frequency=440:sample_rate=44100",
                "-t", "2",
                str(audio_path),
            )
            metadata = await audio_qa._probe(audio_path)
            volume = await audio_qa._volume(audio_path)
            silence = await audio_qa._silence(audio_path, metadata["duration_seconds"])

        self.assertAlmostEqual(metadata["duration_seconds"], 2.0, delta=0.1)
        self.assertEqual(metadata["codec"], "pcm_s16le")
        self.assertIsNotNone(volume["max_volume_db"])
        self.assertEqual(silence["segments"], 0)


if __name__ == "__main__":
    unittest.main()
