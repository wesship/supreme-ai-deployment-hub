"""Run with python -m backend.music.worker on the API's shared pilot volume."""
import json
import logging
import os
import shutil
import subprocess
import sys
import time
import wave

from backend.music import store

log = logging.getLogger(__name__)
MEDIA_INPUT = ["-protocol_whitelist", "file,pipe", "-format_whitelist", "wav,mp3,flac,mov,ogg"]
STEMS = ("vocals", "drums", "bass", "other")


def run(command, timeout):
    # No shell and no user-selected model/flags. Bound both probe and inference.
    return subprocess.run(command, check=True, capture_output=True, timeout=timeout)


def process(job):
    directory = store.root() / job["id"]
    source = directory / "source"
    try:
        probe = run(["ffprobe", "-v", "error", "-show_entries", "format=duration", "-of", "json", *MEDIA_INPUT, str(source)], 30)
        duration = float(json.loads(probe.stdout)["format"]["duration"])
        if not 0 < duration <= 600:
            raise ValueError("Recording must be between 0 and 600 seconds")
        normalized = directory / "input.wav"
        run(["ffmpeg", "-nostdin", "-v", "error", "-y", *MEDIA_INPUT, "-i", str(source), "-vn", "-ac", "2", "-ar", "44100", "-t", "600", str(normalized)], 120)
        command = [sys.executable, "-m", "demucs", "-n", "htdemucs", "--device", os.getenv("MUSIC_STEM_DEVICE", "cpu"),
                   "--out", str(directory / "separated")]
        names = STEMS
        if job["mode"] == "vocals":
            command += ["--two-stems", "vocals"]
            names = ("vocals", "no_vocals")
        run(command + [str(normalized)], 3600)
        outputs = {}
        frame_counts = set()
        for name in names:
            path = directory / "separated" / "htdemucs" / "input" / f"{name}.wav"
            with wave.open(str(path), "rb") as audio:
                if audio.getnchannels() != 2 or audio.getframerate() != 44100 or audio.getnframes() == 0:
                    raise ValueError("Invalid stem output")
                frame_counts.add(audio.getnframes())
            run(["ffmpeg", "-nostdin", "-v", "error", "-y", "-i", str(path), "-t", "30", str(path.with_suffix(".preview.wav"))], 30)
            outputs[name] = str(path.relative_to(directory))
        if len(frame_counts) != 1 or abs(next(iter(frame_counts)) / 44100 - duration) > 1:
            raise ValueError("Stem lengths do not align with the recording")
        store.finish(job["id"], outputs)
    except Exception:
        log.exception("Stem job %s failed", job["id"])
        store.finish(job["id"], error="Audio processing failed. Check the recording or contact the operator.")
    finally:
        source.unlink(missing_ok=True)
        (directory / "input.wav").unlink(missing_ok=True)


def cleanup():
    with store.connect() as db:
        expired = db.execute("SELECT id FROM jobs WHERE created<? AND status!='processing'", (time.time() - 86400,)).fetchall()
        for row in expired:
            shutil.rmtree(store.root() / row["id"], ignore_errors=True)
            db.execute("DELETE FROM jobs WHERE id=?", (row["id"],))


def main():
    if not os.getenv("MUSIC_STEM_DATA_DIR"):
        raise SystemExit("Set MUSIC_STEM_DATA_DIR to the shared persistent pilot volume")
    import importlib.util
    if not importlib.util.find_spec("demucs") or not shutil.which("ffmpeg") or not shutil.which("ffprobe"):
        raise SystemExit("Install worker requirements, FFmpeg, and FFprobe before starting")
    logging.basicConfig(level=logging.INFO)
    while True:
        cleanup()
        job = store.claim()
        if job:
            process(job)
        else:
            time.sleep(2)


if __name__ == "__main__":
    main()
