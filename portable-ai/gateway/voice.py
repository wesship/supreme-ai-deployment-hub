#!/usr/bin/env python3
"""Optional local Whisper bridge. No network access is performed."""
import os
import subprocess
import tempfile
from pathlib import Path

WHISPER_BIN = os.getenv("D3VONN_WHISPER_BIN", "whisper-cli")
WHISPER_MODEL = os.getenv("D3VONN_WHISPER_MODEL", "")


def transcribe_wav(data: bytes) -> str:
    if not WHISPER_MODEL:
        raise RuntimeError("D3VONN_WHISPER_MODEL is not configured")
    model = Path(WHISPER_MODEL).expanduser().resolve()
    if not model.is_file():
        raise RuntimeError("Configured Whisper model does not exist")
    with tempfile.TemporaryDirectory(prefix="d3vonn-whisper-") as td:
        audio = Path(td) / "input.wav"
        output = Path(td) / "transcript"
        audio.write_bytes(data)
        proc = subprocess.run(
            [WHISPER_BIN, "-m", str(model), "-f", str(audio), "-otxt", "-of", str(output)],
            capture_output=True,
            text=True,
            timeout=120,
            check=False,
        )
        if proc.returncode != 0:
            raise RuntimeError(proc.stderr[-1000:] or "Whisper transcription failed")
        txt = Path(str(output) + ".txt")
        return txt.read_text(encoding="utf-8").strip() if txt.exists() else proc.stdout.strip()
