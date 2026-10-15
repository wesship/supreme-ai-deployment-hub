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
job with no update for 4000 seconds fails on the next status read. Ten jobs per
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
