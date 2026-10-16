# D3VONN.IO Stem Studio — private pilot

An independent implementation of the upload → separate → preview → export
workflow reviewed on LALAL.AI. No LALAL.AI code, private endpoints, assets, or
model weights are used. This pilot uses Demucs `htdemucs` as its baseline.
It is not a claim of matching LALAL.AI quality.

## Included

- Music Hub upload interface: vocals/instrumental or four stems.
- Canonical backend authentication; per-owner job reads and WAV downloads.
- Streamed 50 MiB upload limit; worker validates media and limits duration to
  10 minutes, converts to stereo 44.1 kHz, then separates outside the API.
- Shared Web Audio clock for 30-second stem previews; pause, restart, solo,
  volume. Full stems download separately to bound preview memory.
- Individual original stem WAV downloads, not a rendered mixer export.
- SQLite job spool with transactional claims, explicit failure states, quotas,
  interrupted-job recovery, and worker-driven 24-hour file retention.

## Run a local pilot

Install the normal backend dependencies in the API environment. Install
`backend/music/requirements-worker.txt` in a separate Python 3.11 environment
with system FFmpeg/FFprobe. Torch CPU/CUDA wheel selection must match the worker
host; the pinned baseline has not yet been qualified on this deployment.

API and worker MUST run on the **same host** and see the same persistent local
volume at the same absolute path. SQLite is not a distributed task queue; do
not place its database on a network share, split it across Railway volumes,
or enable this pilot across independently stored replicas.

Set these on the API and worker:

```sh
export MUSIC_STEM_DATA_DIR=/absolute/private/persistent/stem-studio
export MUSIC_STEMS_ENABLED=true
# worker only: cpu, cuda, or mps, after device qualification
export MUSIC_STEM_DEVICE=cpu
python -m backend.music.worker
```

Start the canonical API normally. The frontend uses its existing VITE_API_URL
and signed-in session token. No model/provider API key is needed. The worker
will fetch Demucs weights on first inference, so pre-cache and qualify them
before opening the pilot. Canonical authentication must remain enabled on
shared deployments.

The feature defaults to unavailable unless explicitly enabled with a data
volume. The capabilities endpoint reports configuration, **not worker health**.
A queued job means accepted by the spool, not that inference has started. A
job with no update for 4500 seconds fails on the next status read. Ten jobs per
user per rolling 24 hours and 100 retained jobs globally bound pilot capacity.
Expired records and files are purged while the worker is running; if the
worker is stopped, the operator must resume it to run retention cleanup.
Sources are removed after processing; separated WAVs remain until retention.

## Validation

```sh
python -m pytest backend/tests/test_music_stem_studio.py -q
pnpm exec eslint src/components/music/StemStudio.tsx src/pages/Music.tsx src/services/stemStudio.ts
pnpm typecheck
```

Backend tests cover authorization, cross-account isolation, quotas, size and
format rejection, ownership of downloads, path containment, claims/recovery,
retention, invalid media through real FFprobe, and orchestration/output checks
with inference mocked. Mocked inference does **not** certify model quality,
GPU operation, memory consumption, or model installation compatibility.

Before production: run real owned/licensed music through the pinned model;
listen for bleed/artifacts; measure wall time and peak memory; verify desktop
and mobile playback and downloads with two real accounts; verify storage
retention; move jobs/assets into the canonical distributed storage/queue
architecture for multi-host use. Durable Music Hub project attachment, Hermes
tool registration, clean-speech models, extra instrument models, bundled ZIP
exports, and voice conversion are follow-up work.

Demucs code: https://github.com/facebookresearch/demucs (MIT; archived).
Retain its license and review the exact checkpoint provenance and terms before
redistributing a worker image. Audio Separator remains a candidate for later
model expansion: https://github.com/nomadkaraoke/python-audio-separator .

## Implementation checks — 2026-10-15

- Backend: 17 focused tests passed. FFprobe/FFmpeg ran on test media; Demucs
  inference was mocked.
- Frontend: 5 Stem Studio tests and 9 existing music-provider tests passed.
  Coverage includes repeated polling failure recovery and common-clock playback.
- Changed frontend files: ESLint passed.
- Production Vite build and client bundle credential scan passed.
- Full `tsc --noEmit -p tsconfig.app.json`: five errors in untouched
  HermesGovernancePanel, AIFilms tests, and KnowledgeGraphOS. Reproduced the same
  errors in a detached checkout of starting commit `9b334b60`.
- Node 24 / pnpm 9 were available for these checks; the repo's Node 22 CI
  remains authoritative.
- Browser verification could not run: Chromium installation returned a corrupt
  or truncated download. Desktop/mobile rendered QA, real authenticated
  two-account tests, and actual model inference remain open.

No live deployment, merge, paid provider setup, or publishing was performed.

## Music Workbench expansion — 2026-10-16

The Music Hub now includes Recording Tools and Beat & Melody Lab alongside
Stem Studio. The eight recommended projects are integrated as documented in
`THIRD_PARTY.md`; this describes implementation, not deployment approval.

Browser features (lazy-loaded audio libraries):

- WaveSurfer waveform playback, draggable selection, numeric/keyboard selection
  boundaries, local PCM16 WAV selection export, and estimated beat overlays
  when an analysis report is loaded.
- Tone.js 16-step kick/snare/hi-hat sequencer, tempo control, pattern JSON export,
  three synth sounds, editable note audition, and edited Standard MIDI export.
- Original full MIDI files download separately from the 30-second/512-note
  audition window; the first 32 preview notes have visible editing controls.
- Local files and note previews clear when the authenticated account changes.

Worker operations:

| Mode | Output | Runtime qualification |
| --- | --- | --- |
| analyze | Estimated tempo, beat times, key/correlation JSON | Real generated-audio job passed |
| trim | Selected WAV and short preview | Real FFmpeg job passed |
| loudness | Gain-adjusted WAV, achieved/target LUFS report | Real pyloudnorm job passed |
| midi | Original MIDI, editable notes JSON | Real Basic Pitch ONNX CPU smoke passed |
| transcribe | Aligned word/segment JSON, text, SRT | Adapter tested with fakes; actual model pending |
| clean_speech | Mono noise-reduced WAV | Adapter tested with fakes; actual model pending |
| separate_advanced | Alternative model stem WAVs | Adapter tested with fakes; actual checkpoint pending |

All worker tools default to unavailable. The API's capabilities endpoint reports
configured operation flags, not hardware health or a qualification certificate.
A host operator should enable an operation only after testing its environment.
Use the existing shared persistent pilot volume and canonical authentication.
An example configuration for the lightweight tool pilot is:

```sh
export MUSIC_STEMS_ENABLED=true
export MUSIC_STEM_DATA_DIR=/absolute/private/persistent/stem-studio
export MUSIC_TOOLS_ENABLED=analyze,trim,loudness
```

Install `requirements-analysis.txt` in the worker interpreter for these tools.
Each ML package has a separate `requirements-*.txt` file because their Python,
Torch, NumPy, TensorFlow, and ONNX constraints can conflict. Select a separate
interpreter per mode as needed, for example:

```sh
export MUSIC_TOOL_PYTHON_ANALYZE=/absolute/analysis-env/bin/python
export MUSIC_TOOL_PYTHON_LOUDNESS=/absolute/analysis-env/bin/python
export MUSIC_TOOL_PYTHON_MIDI=/absolute/midi-env/bin/python
export MUSIC_TOOL_PYTHON_TRANSCRIBE=/absolute/transcribe-env/bin/python
export MUSIC_TOOL_PYTHON_CLEAN_SPEECH=/absolute/cleanup-env/bin/python
export MUSIC_TOOL_PYTHON_SEPARATE_ADVANCED=/absolute/separation-env/bin/python
```

Run the coordinator from the repository root so its child interpreters can
import `backend.music.tools_cli`. Keep interpreters, model selectors, model
caches, and optional tokens server-side. `MUSIC_SEPARATOR_MODEL` must name a
qualified registry checkpoint (no paths/URLs supplied by users). WhisperX uses
its small model; `MUSIC_TRANSCRIBE_DEVICE` defaults to CPU/int8. Optional speaker
diarization requires `MUSIC_DIARIZATION_ENABLED=true`, a server-side `HF_TOKEN`,
and access to its upstream model. The default transcription path does not
require the diarization token. No paid provider is configured.

Job settings accept only operation-specific numeric selection boundaries or
LUFS targets. Artifact downloads and previews enforce canonical job ownership.
The existing SQLite spool is migrated additively to store options, and database
connections now close explicitly. Interrupted jobs time out after 4500 seconds
to cover bounded tool execution and preview generation. The single-host and
worker-driven 24-hour retention constraints still apply.

Verification for this expansion:

- 39 backend tests passed, including real generated-audio analysis, trim, and
  loudness jobs; cross-account artifact denial; option validation; additive
  spool migration; model adapter contracts; and exact cleanup resample length.
- 27 frontend tests passed (new recording/beat/export tests, existing Stem
  Studio tests, and existing music-provider tests).
- MIDI smoke: a real bundled Basic Pitch ONNX model transcribed a 3-second
  harmonic C4 into a MIDI containing one pitch-60 note. This was an experimental
  Python 3.12 environment with explicit ONNX dependencies and setuptools 80.9;
  Basic Pitch's normal supported Python/runtime dependency set still needs
  production qualification. Re-run the check with `python -m backend.music.smoke_midi`.
- Changed frontend files pass ESLint. Production Vite build and client bundle
  credential scan pass. The full application TypeScript check still reports
  the five previously reproduced errors in untouched Knowledge Graph and AI
  Films files; no expansion-file errors remain.
- Rendered browser/audio QA remains blocked by corrupt/truncated Chromium
  downloads, including the smaller headless-shell download. Component tests
  use controlled browser/audio fakes and do not certify real device playback.
- Actual speech cleanup, transcription/diarization, alternative separation,
  GPU behavior, long recordings, two live authenticated accounts, and live
  persistence/retention remain qualification gates. No providers were enabled,
  and no live deployment or merge was performed.

### Shared-clock mixer integration

The Music route now uses an account-keyed `MusicProductionStudio` bridge. Set
`VITE_MUSIC_WEB_AUDIO_MIXER=true` at build time to expose the mixer; it remains
off by default. Loaded Stem Studio previews can be opened directly in the mixer
using their existing decoded buffers. These remain previews of up to 30 seconds;
full-length mixing requires importing the full stems separately. Switching
accounts remounts the session and clears its buffers.

| Parallel work reviewed | Integration decision |
| --- | --- |
| #1421 WaveSurfer workbench | Retained as the single recording editor |
| #1422 shared-clock mixer at `8e9a4e1109980d7e30dcc57d218378a124dffae6` | Ported and hardened with cancellation and memory bounds |
| #1422 HTML-media timeline and duplicate editor | Not mounted on the combined Music route |
| #1422 homepage, Lighthouse, database and migration changes | Not imported in this integration |
| #1421 authenticated processing API and worker | Retained; no new database or worker path |

The mixer supports eight mono/stereo tracks, at most 128 MiB of decoded audio,
and a ten-minute input duration limit. Metadata is checked before local decode;
offline rendering has a separate 128 MiB estimated working-set limit. Playback
uses one Web Audio clock, supports live mute/solo/gain, and exports stereo PCM16
WAV with sample-peak reduction above 0.98. It does not provide loudness mastering
or true-peak limiting. Cancellation suppresses stale playback, imports and exports.

Integration verification: 48 frontend tests cover buffer handoff, account reset,
synchronized scheduling, cancellation, mute/solo gain, resource cleanup, metadata
limits, PCM encoding and existing Music behavior. These use controlled browser
and audio fakes; real-device playback, full model qualification and production
persistence remain open. The separate #1422 branch is unchanged and still needs
review before any eventual merge.

Extended checks (install analysis requirements for real DSP tests):

```sh
python -m pytest backend/tests/test_music_tools.py backend/tests/test_music_stem_studio.py -q
pnpm exec vitest run src/components/music/__tests__ src/__tests__/musicProviderPolicy.test.ts src/__tests__/musicProviderRouter.test.ts
```
