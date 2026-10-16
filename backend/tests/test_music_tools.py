"""Real audio for light tools; model interfaces are exercised with explicit fakes."""
import io
import json
from pathlib import Path
import sqlite3
import sys
from types import SimpleNamespace

import numpy as np
import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient

from backend.app.middleware.auth import get_current_user_id
from backend.music import store, tools_cli, worker
from backend.music.operations import validate_options
from backend.music.router import router


@pytest.fixture
def client(monkeypatch, tmp_path):
    monkeypatch.setenv('MUSIC_STEMS_ENABLED', 'true')
    monkeypatch.setenv('MUSIC_STEM_DATA_DIR', str(tmp_path))
    monkeypatch.setenv('MUSIC_TOOLS_ENABLED', 'analyze,trim,loudness,midi,transcribe,clean_speech,separate_advanced')
    app = FastAPI(); app.include_router(router)
    app.dependency_overrides[get_current_user_id] = lambda: 'alice'
    with TestClient(app) as client:
        yield client


def recording(seconds=4, silent=False):
    sf = pytest.importorskip('soundfile')
    sr = 44100
    t = np.arange(int(seconds * sr)) / sr
    signal = np.zeros_like(t) if silent else 0.03 * (np.sin(2 * np.pi * 261.63 * t) + np.sin(2 * np.pi * 329.63 * t) + np.sin(2 * np.pi * 392 * t))
    if not silent:
        for beat in np.arange(0, seconds - 0.1, 0.5):
            start = round(beat * sr)
            n = round(0.03 * sr)
            signal[start:start + n] += 0.2 * np.hanning(n) * np.random.default_rng(start).normal(size=n)
    data = io.BytesIO(); sf.write(data, signal, sr, format='WAV', subtype='PCM_16')
    return data.getvalue()


def upload(client, mode, settings=None, audio=None):
    return client.post('/api/music/stems/jobs', files={'file': ('owned.wav', audio if audio is not None else b'audio')}, data={'mode': mode, 'rights_confirmed': 'true', 'settings': json.dumps(settings if settings is not None else {})})


@pytest.mark.parametrize('mode,options', [('trim', {}), ('trim', {'start_seconds': 2, 'end_seconds': 1}), ('trim', {'start_seconds': -1, 'end_seconds': 2}), ('trim', {'start_seconds': 0, 'end_seconds': 601}), ('loudness', {'target_lufs': -2}), ('analyze', {'target_lufs': -14}), ('midi', {'model': 'untrusted'}), ('analyze', [])])
def test_options_are_operation_specific(client, mode, options):
    assert upload(client, mode, options).status_code == 422


def test_nan_settings_rejected():
    with pytest.raises(ValueError):
        validate_options('trim', {'start_seconds': float('nan'), 'end_seconds': 2})


def test_tools_require_individual_gate(client, monkeypatch):
    monkeypatch.setenv('MUSIC_TOOLS_ENABLED', '')
    assert client.get('/api/music/stems/capabilities').json()['tools'] == []
    assert upload(client, 'analyze').status_code == 503


@pytest.mark.parametrize('mode,settings,artifact', [('trim', {'start_seconds': 1, 'end_seconds': 2}, 'selection'), ('loudness', {'target_lufs': -18}, 'loudness'), ('analyze', {}, 'analysis')])
def test_real_worker_flow_and_private_artifacts(client, mode, settings, artifact):
    sf = pytest.importorskip('soundfile')
    if mode == 'analyze': pytest.importorskip('librosa')
    if mode == 'loudness': pytest.importorskip('pyloudnorm')
    response = upload(client, mode, settings, recording())
    assert response.status_code == 202
    job_id = response.json()['id']
    worker.process(store.claim())
    job = client.get(f'/api/music/stems/jobs/{job_id}').json()
    assert job['status'] == 'completed', job
    assert artifact in {item['name'] for item in job['artifacts']}
    result = client.get(f'/api/music/stems/jobs/{job_id}/artifacts/{artifact}')
    assert result.status_code == 200
    assert result.headers['cache-control'] == 'no-store'
    if mode == 'trim':
        audio, sr = sf.read(io.BytesIO(result.content))
        assert abs(len(audio) / sr - 1) < 0.01
    elif mode == 'loudness':
        report = result.json()
        assert report['output_lufs'] <= -18 + 0.2
        assert report['output_lufs'] - report['input_lufs'] == pytest.approx(report['gain_db'], abs=0.1)
        if report['output_lufs'] < -18.2:
            assert report['sample_peak_dbfs'] == pytest.approx(-1, abs=0.01)
        assert report['sample_peak_dbfs'] <= -1 + 1e-6
    else:
        report = result.json()
        assert 90 < report['tempo_bpm'] < 150
        assert len(report['beat_seconds']) >= 3
        assert report['key_estimate'] is not None
    client.app.dependency_overrides[get_current_user_id] = lambda: 'bob'
    assert client.get(f'/api/music/stems/jobs/{job_id}/artifacts/{artifact}').status_code == 404


def test_silence_loudness_has_finite_json(tmp_path):
    pytest.importorskip('soundfile'); pytest.importorskip('pyloudnorm')
    source = tmp_path / 'silence.wav'; source.write_bytes(recording(silent=True))
    tools_cli.loudness(source, tmp_path, {})
    report = json.loads((tmp_path / 'loudness.json').read_text())
    assert report['input_lufs'] is None and report['output_lufs'] is None
    assert report['gain_db'] == 0


def test_trim_past_end_fails(client):
    job_id = upload(client, 'trim', {'start_seconds': 2, 'end_seconds': 5}, recording()).json()['id']
    worker.process(store.claim())
    assert store.get_job(job_id, 'alice')['status'] == 'failed'


def test_existing_database_gets_options_column(monkeypatch, tmp_path):
    monkeypatch.setenv('MUSIC_STEM_DATA_DIR', str(tmp_path))
    with sqlite3.connect(tmp_path / 'jobs.sqlite') as db:
        db.execute("CREATE TABLE jobs(id TEXT PRIMARY KEY,owner TEXT,mode TEXT,status TEXT,created REAL,updated REAL,outputs TEXT,error TEXT)")
    with store.connect() as db:
        assert 'options' in {row['name'] for row in db.execute('PRAGMA table_info(jobs)')}


def test_midi_adapter_uses_predict_output(monkeypatch, tmp_path):
    note = SimpleNamespace(pitch=60, start=0.0, end=0.5, velocity=80)
    model_result = SimpleNamespace(instruments=[SimpleNamespace(notes=[note])], write=lambda path: Path(path).write_bytes(b'MThd'))
    fake = SimpleNamespace(predict=lambda path: (None, model_result, []))
    monkeypatch.setitem(sys.modules, 'basic_pitch', SimpleNamespace())
    monkeypatch.setitem(sys.modules, 'basic_pitch.inference', fake)
    artifacts = tools_cli.midi(tmp_path / 'input.wav', tmp_path, {})
    assert artifacts['midi'] == 'melody.mid'
    assert json.loads((tmp_path / 'notes.json').read_text())['notes'][0]['duration'] == 0.5


def test_separator_model_is_operator_selected(monkeypatch, tmp_path):
    calls = []
    class Separator:
        def __init__(self, **kwargs):
            assert kwargs['output_dir'] == str(tmp_path)
        def load_model(self, **kwargs): calls.append(kwargs)
        def separate(self, source):
            (tmp_path / 'vocals.wav').write_bytes(b'fake model audio')
            return ['vocals.wav']
    monkeypatch.setitem(sys.modules, 'audio_separator', SimpleNamespace())
    monkeypatch.setitem(sys.modules, 'audio_separator.separator', SimpleNamespace(Separator=Separator))
    monkeypatch.setenv('MUSIC_SEPARATOR_MODEL', 'qualified.onnx')
    assert tools_cli.separate_advanced(tmp_path / 'input.wav', tmp_path, {}) == {'stem_1': 'vocals.wav'}
    assert calls == [{'model_filename': 'qualified.onnx'}]
    monkeypatch.setenv('MUSIC_SEPARATOR_MODEL', '../untrusted.onnx')
    with pytest.raises(ValueError): tools_cli.separate_advanced(tmp_path / 'input.wav', tmp_path, {})


def test_worker_rejects_manifest_traversal(client, monkeypatch):
    job_id = upload(client, 'analyze').json()['id']
    real_run = worker.run
    def run(command, timeout):
        if 'backend.music.tools_cli' in command:
            output = store.root() / job_id / 'tools'
            (output / 'artifacts.json').write_text(json.dumps({'analysis': '../../private.json'}))
            return SimpleNamespace(stdout=b'')
        return real_run(command, timeout)
    monkeypatch.setattr(worker, 'run', run)
    worker.process(store.claim())
    assert store.get_job(job_id, 'alice')['status'] == 'failed'


def test_caption_timestamp():
    assert tools_cli.timestamp(3661.234) == '01:01:01,234'


def test_clean_speech_adapter_preserves_duration_and_outputs_mono(monkeypatch, tmp_path):
    sf = pytest.importorskip('soundfile'); pytest.importorskip('librosa')
    source = tmp_path / 'source.wav'; source.write_bytes(recording(seconds=1))
    class Tensor:
        def __init__(self, data): self.data = data
        def __getitem__(self, selection): return Tensor(self.data[selection])
        def detach(self): return self
        def cpu(self): return self
        def numpy(self): return self.data
    fake_df = SimpleNamespace(init_df=lambda **kwargs: (object(), SimpleNamespace(sr=lambda: 48000), 'suffix', 1), enhance=lambda model, state, audio, pad: audio)
    monkeypatch.setitem(sys.modules, 'torch', SimpleNamespace(from_numpy=Tensor))
    monkeypatch.setitem(sys.modules, 'df', SimpleNamespace())
    monkeypatch.setitem(sys.modules, 'df.enhance', fake_df)
    assert tools_cli.clean_speech(source, tmp_path, {}) == {'clean_speech': 'cleaned.wav'}
    audio, sr = sf.read(tmp_path / 'cleaned.wav')
    assert sr == 48000 and audio.ndim == 1 and len(audio) == 48000


def test_transcription_alignment_captions_and_optional_diarization(monkeypatch, tmp_path):
    calls = []
    segments = [{'start': 0.1, 'end': 1.2, 'text': 'Hello\nworld', 'words': [{'word': 'Hello', 'start': 0.1, 'end': 0.5}]}]
    def diarization(**kwargs):
        assert kwargs['token'] == 'test-token'
        return lambda audio: 'speaker-segments'
    def assign(speakers, aligned):
        calls.append(speakers); return aligned
    fake = SimpleNamespace(load_model=lambda *args, **kwargs: SimpleNamespace(transcribe=lambda *args, **kwargs: {'language': 'en', 'segments': segments}), load_audio=lambda path: 'audio', load_align_model=lambda **kwargs: ('align-model', 'metadata'), align=lambda *args, **kwargs: {'segments': segments}, assign_word_speakers=assign)
    monkeypatch.setitem(sys.modules, 'whisperx', fake)
    monkeypatch.setitem(sys.modules, 'whisperx.diarize', SimpleNamespace(DiarizationPipeline=diarization))
    monkeypatch.setenv('MUSIC_DIARIZATION_ENABLED', 'true'); monkeypatch.setenv('HF_TOKEN', 'test-token')
    artifacts = tools_cli.transcribe(tmp_path / 'source.wav', tmp_path, {})
    assert artifacts['captions'] == 'captions.srt'
    report = json.loads((tmp_path / 'transcript.json').read_text())
    assert report['diarized'] and report['segments'][0]['words'][0]['start'] == 0.1
    assert calls == ['speaker-segments']
    assert '00:00:00,100 --> 00:00:01,200\nHello world' in (tmp_path / 'captions.srt').read_text()
