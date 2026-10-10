"""Optional local Whisper bridge. No network access is performed by this module."""

from __future__ import annotations

import shutil
import subprocess
import tempfile
from pathlib import Path


def _resolve_binary(value: str) -> str:
    if not value:
        raise RuntimeError("D3VONN_WHISPER_BIN is not configured")
    if "/" in value or "\\" in value:
        binary = Path(value).expanduser().resolve()
        if not binary.is_file():
            raise RuntimeError("Configured Whisper binary does not exist")
        return str(binary)
    resolved = shutil.which(value)
    if not resolved:
        raise RuntimeError("Configured Whisper binary is not available")
    return resolved


def transcribe_wav(data: bytes, *, binary: str, model_path: str, timeout: int) -> str:
    if not model_path:
        raise RuntimeError("D3VONN_WHISPER_MODEL is not configured")
    model = Path(model_path).expanduser().resolve()
    if not model.is_file():
        raise RuntimeError("Configured Whisper model does not exist")

    executable = _resolve_binary(binary)
    with tempfile.TemporaryDirectory(prefix="d3vonn-whisper-") as temp_dir:
        audio = Path(temp_dir) / "input.wav"
        output = Path(temp_dir) / "transcript"
        audio.write_bytes(data)
        process = subprocess.run(
            [executable, "-m", str(model), "-f", str(audio), "-otxt", "-of", str(output)],
            capture_output=True,
            text=True,
            timeout=timeout,
            check=False,
        )
        if process.returncode != 0:
            raise RuntimeError("Whisper transcription failed")
        transcript = Path(f"{output}.txt")
        text = transcript.read_text(encoding="utf-8") if transcript.exists() else process.stdout
        return text.strip()[:1_000_000]
