"""Run with python -m backend.music.worker on the API's shared pilot volume."""
import json
import logging
import os
from pathlib import Path
import re
import shutil
import subprocess
import sys
import time
import wave

from backend.music import store
from backend.music.operations import available_tools, validate_options

log = logging.getLogger(__name__)
MEDIA_INPUT = ["-protocol_whitelist", "file,pipe", "-format_whitelist", "wav,mp3,flac,mov,ogg"]
STEMS = ("vocals", "drums", "bass", "other")


def run(command, timeout):
    # No shell and no user-selected model/flags. Bound both probe and inference.
    return subprocess.run(command, check=True, capture_output=True, timeout=timeout)


def process_tool(job, normalized, directory, duration):
    mode = job['mode']
    if mode not in available_tools():
        raise ValueError('Audio tool is not enabled on this worker')
    options = validate_options(mode, json.loads(job.get('options', '{}')))
    output = directory / 'tools'
    output.mkdir()
    if mode == 'trim':
        start, end = options['start_seconds'], options['end_seconds']
        if end > duration + 0.01:
            raise ValueError('Selection exceeds recording duration')
        run(['ffmpeg', '-nostdin', '-v', 'error', '-y', '-i', str(normalized), '-ss', str(start), '-t', str(end - start), str(output / 'selection.wav')], 120)
        manifest = {'selection': 'selection.wav'}
    else:
        options_path = directory / 'options.json'
        options_path.write_text(json.dumps(options))
        interpreter = os.getenv(f'MUSIC_TOOL_PYTHON_{mode.upper()}', sys.executable)
        run([interpreter, '-m', 'backend.music.tools_cli', mode, str(normalized), str(output), str(options_path)], 3500)
        manifest = json.loads((output / 'artifacts.json').read_text())
    if not isinstance(manifest, dict) or not 1 <= len(manifest) <= 16:
        raise ValueError('Invalid artifact manifest')
    outputs = {}
    for name, filename in manifest.items():
        if not re.fullmatch(r'[a-zA-Z0-9_-]{1,64}', name) or not isinstance(filename, str):
            raise ValueError('Invalid artifact name')
        path = (output / filename).resolve()
        if not path.is_relative_to(output.resolve()) or not path.is_file() or path.suffix not in {'.wav', '.json', '.mid', '.txt', '.srt'}:
            raise ValueError('Invalid artifact path')
        if path.suffix == '.wav':
            with wave.open(str(path), 'rb') as audio:
                if audio.getnchannels() not in (1, 2) or not 8000 <= audio.getframerate() <= 96000 or not 0 < audio.getnframes() / audio.getframerate() <= 601:
                    raise ValueError('Invalid processed audio')
            run(['ffmpeg', '-nostdin', '-v', 'error', '-y', '-i', str(path), '-t', '30', str(path.with_suffix('.preview.wav'))], 30)
        elif path.stat().st_size > 10 * 1024 * 1024:
            raise ValueError('Artifact exceeds size limit')
        outputs[name] = str(path.relative_to(directory))
    return outputs


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
        if job['mode'] not in ('vocals', 'four_stems'):
            store.finish(job['id'], process_tool(job, normalized, directory, duration))
            return
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
    if not shutil.which("ffmpeg") or not shutil.which("ffprobe"):
        raise SystemExit("Install FFmpeg and FFprobe before starting")
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
