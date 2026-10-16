"""Optional real inference check: python -m backend.music.smoke_midi.

Uses a generated harmonic C4, never uploads audio, and cleans temporary files.
This checks runtime wiring; it does not certify transcription quality on music.
"""
import json
from pathlib import Path
from tempfile import TemporaryDirectory
import time


def main():
    import numpy as np
    import soundfile as sf
    from backend.music.tools_cli import midi
    with TemporaryDirectory(prefix='music-midi-smoke-') as temporary:
        directory = Path(temporary)
        sr = 22050
        t = np.arange(sr * 3) / sr
        frequency = 261.625565
        audio = sum(amplitude * np.sin(2 * np.pi * harmonic * frequency * t) for harmonic, amplitude in [(1, .2), (2, .1), (3, .05)])
        audio *= np.minimum(1, t / .05) * np.minimum(1, (3 - t) / .05)
        source = directory / 'c4.wav'
        sf.write(source, audio, sr)
        started = time.perf_counter()
        midi(source, directory, {})
        notes = json.loads((directory / 'notes.json').read_text())['notes']
        if not (directory / 'melody.mid').read_bytes().startswith(b'MThd') or not any(note['pitch'] == 60 for note in notes):
            raise SystemExit('MIDI smoke failed: expected a valid MIDI file containing C4')
        print(json.dumps({'status': 'passed', 'notes': len(notes), 'pitches': sorted({note['pitch'] for note in notes}), 'seconds': round(time.perf_counter() - started, 3)}))


if __name__ == '__main__':
    main()
