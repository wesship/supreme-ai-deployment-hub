"""Isolated worker entry point: python -m backend.music.tools_cli MODE IN OUT OPTIONS.

Optional packages are imported only within their operation. Each operation may
run under its own MUSIC_TOOL_PYTHON_<MODE> interpreter to avoid ML conflicts.
"""
import json
import math
import os
from pathlib import Path
import re
import sys


def write_json(path, data):
    path.write_text(json.dumps(data, allow_nan=False, ensure_ascii=False), encoding='utf-8')


def analyze(source, output, options):
    import librosa
    import numpy as np
    y, sr = librosa.load(source, sr=22050, mono=True)
    tempo, beats = librosa.beat.beat_track(y=y, sr=sr, trim=False)
    chroma = librosa.feature.chroma_stft(y=y, sr=sr).mean(axis=1)
    # Krumhansl-style profile comparison is an estimate, not a calibrated probability.
    major = np.array([6.35, 2.23, 3.48, 2.33, 4.38, 4.09, 2.52, 5.19, 2.39, 3.66, 2.29, 2.88])
    minor = np.array([6.33, 2.68, 3.52, 5.38, 2.60, 3.53, 2.54, 4.75, 3.98, 2.69, 3.34, 3.17])
    pitch_names = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B']
    guesses = []
    if np.std(chroma) > 1e-8:
        for name, profile in [('major', major), ('minor', minor)]:
            for pitch in range(12):
                score = float(np.corrcoef(chroma, np.roll(profile, pitch))[0, 1])
                guesses.append((score, f'{pitch_names[pitch]} {name}'))
    guesses.sort(reverse=True)
    report = {'duration_seconds': float(len(y) / sr), 'tempo_bpm': float(np.asarray(tempo).reshape(-1)[0]),
              'beat_seconds': librosa.frames_to_time(beats, sr=sr).tolist(),
              'key_estimate': guesses[0][1] if guesses else None,
              'key_correlation': guesses[0][0] if guesses else None,
              'note': 'Tempo and key are estimates; verify by ear. Key correlation is not a probability.'}
    write_json(output / 'analysis.json', report)
    return {'analysis': 'analysis.json'}


def loudness(source, output, options):
    import numpy as np
    import pyloudnorm as pyln
    import soundfile as sf
    audio, sr = sf.read(source, always_2d=True)
    if len(audio) < int(sr * 0.5):
        raise ValueError('Loudness measurement needs at least half a second')
    meter = pyln.Meter(sr)
    before = float(meter.integrated_loudness(audio))
    peak = float(np.max(np.abs(audio)))
    target = options.get('target_lufs', -14)
    gain = 0.0
    if math.isfinite(before) and peak > 0:
        gain = min(target - before, -1.0 - 20 * math.log10(peak))
    normalized = audio * (10 ** (gain / 20))
    after = float(meter.integrated_loudness(normalized))
    report = {'input_lufs': before if math.isfinite(before) else None,
              'output_lufs': after if math.isfinite(after) else None, 'target_lufs': target, 'gain_db': gain,
              'sample_peak_dbfs': 20 * math.log10(float(np.max(np.abs(normalized)))) if peak else None,
              'note': 'Gain-only normalization with -1 dBFS sample-peak headroom. No true-peak measurement or limiter.'}
    sf.write(output / 'normalized.wav', normalized, sr, subtype='PCM_24')
    write_json(output / 'loudness.json', report)
    return {'normalized': 'normalized.wav', 'loudness': 'loudness.json'}


def midi(source, output, options):
    from basic_pitch.inference import predict
    _, midi_data, _ = predict(str(source))
    midi_data.write(str(output / 'melody.mid'))
    notes = [{'pitch': int(note.pitch), 'start': float(note.start), 'duration': float(note.end - note.start),
              'velocity': float(note.velocity / 127)} for instrument in midi_data.instruments for note in instrument.notes]
    notes.sort(key=lambda note: note['start'])
    write_json(output / 'notes.json', {'notes': notes, 'note': 'Automatic transcription; review and edit the notes. Best on isolated instruments.'})
    return {'midi': 'melody.mid', 'notes': 'notes.json'}


def clean_speech(source, output, options):
    import librosa
    import numpy as np
    import soundfile as sf
    import torch
    from df.enhance import init_df, enhance
    # Version 0.5 supports extended metadata; use only the model and DF state.
    loaded = init_df(log_file=None)
    model, state = loaded[:2]
    audio, sr = librosa.load(source, sr=state.sr(), mono=True)
    info = sf.info(source)
    expected = round(info.frames * state.sr() / info.samplerate)
    audio = np.pad(audio, (0, max(0, expected - len(audio))))[:expected]
    enhanced = enhance(model, state, torch.from_numpy(np.asarray(audio, dtype=np.float32))[None, :], pad=True)
    sf.write(output / 'cleaned.wav', enhanced.detach().cpu().numpy().reshape(-1), state.sr(), subtype='PCM_24')
    return {'clean_speech': 'cleaned.wav'}


def timestamp(seconds):
    milliseconds = max(0, round(float(seconds) * 1000))
    hours, rest = divmod(milliseconds, 3600000)
    minutes, rest = divmod(rest, 60000)
    secs, ms = divmod(rest, 1000)
    return f'{hours:02d}:{minutes:02d}:{secs:02d},{ms:03d}'


def transcribe(source, output, options):
    import whisperx
    device = os.getenv('MUSIC_TRANSCRIBE_DEVICE', 'cpu')
    model = whisperx.load_model('small', device, compute_type='int8' if device == 'cpu' else 'float16')
    audio = whisperx.load_audio(str(source))
    result = model.transcribe(audio, batch_size=4)
    align_model, metadata = whisperx.load_align_model(language_code=result['language'], device=device)
    aligned = whisperx.align(result['segments'], align_model, metadata, audio, device, return_char_alignments=False)
    diarized = False
    if os.getenv('MUSIC_DIARIZATION_ENABLED', '').lower() == 'true':
        from whisperx.diarize import DiarizationPipeline
        token = os.getenv('HF_TOKEN')
        if not token:
            raise ValueError('Diarization token is not configured')
        pipeline = DiarizationPipeline(token=token, device=device)
        aligned = whisperx.assign_word_speakers(pipeline(audio), aligned)
        diarized = True
    report = {'language': result['language'], 'segments': aligned['segments'], 'diarized': diarized,
              'note': 'Machine transcript; verify words and timestamps, especially singing.'}
    write_json(output / 'transcript.json', report)
    (output / 'transcript.txt').write_text('\n'.join(segment.get('text', '').strip() for segment in aligned['segments']), encoding='utf-8')
    captions = []
    for i, segment in enumerate(aligned['segments'], 1):
        text = segment.get('text', '').strip().replace('\r', ' ').replace('\n', ' ').replace('-->', '→')
        captions.append(f"{i}\n{timestamp(segment['start'])} --> {timestamp(segment['end'])}\n{text}\n")
    (output / 'captions.srt').write_text('\n'.join(captions), encoding='utf-8')
    return {'transcript': 'transcript.json', 'text': 'transcript.txt', 'captions': 'captions.srt'}


def separate_advanced(source, output, options):
    from audio_separator.separator import Separator
    model = os.getenv('MUSIC_SEPARATOR_MODEL', '')
    if not re.fullmatch(r'[a-zA-Z0-9_.-]+\.(ckpt|onnx|pth|yaml)', model) or '..' in model:
        raise ValueError('Configure a qualified separator model filename')
    separator = Separator(output_dir=str(output), output_format='WAV', sample_rate=44100,
                          model_file_dir=os.getenv('MUSIC_SEPARATOR_CACHE', '/tmp/audio-separator-models'))
    separator.load_model(model_filename=model)
    results = separator.separate(str(source))
    manifest = {}
    for i, filename in enumerate(results):
        path = Path(filename)
        if not path.is_absolute():
            path = output / path
        path = path.resolve()
        if not path.is_relative_to(output.resolve()) or path.suffix.lower() != '.wav' or not path.is_file():
            raise ValueError('Separator returned an invalid output')
        # Stable public keys; preserve upstream filenames privately in the manifest.
        manifest[f'stem_{i + 1}'] = str(path.relative_to(output))
    if not 1 <= len(manifest) <= 12:
        raise ValueError('Separator returned no usable stems')
    return manifest


OPERATIONS = {'analyze': analyze, 'loudness': loudness, 'midi': midi, 'transcribe': transcribe,
              'clean_speech': clean_speech, 'separate_advanced': separate_advanced}


def main():
    mode, source, directory, options_path = sys.argv[1:]
    output = Path(directory).resolve()
    output.mkdir(exist_ok=True)
    manifest = OPERATIONS[mode](Path(source), output, json.loads(Path(options_path).read_text()))
    write_json(output / 'artifacts.json', manifest)


if __name__ == '__main__':
    main()
