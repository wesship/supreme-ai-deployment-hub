# D3VONN Portable AI

Offline-first local AI runtime for D3VONN.IO. The portable bundle is designed to run from a local folder or USB drive on macOS, Linux, and Windows without requiring cloud AI APIs.

## Architecture

- `llama.cpp` / GGUF for local text generation
- `whisper.cpp` for offline speech-to-text
- Python standard-library HTTP gateway for a minimal dependency footprint
- explicit offline policy: cloud providers are disabled unless `D3VONN_OFFLINE=0`
- model files live outside source control under `models/`
- optional NVIDIA/Apple acceleration is selected by the underlying runtimes
- minimal local browser console under `web/`

## Quick start

1. Install `llama.cpp` and `whisper.cpp` binaries for the host platform.
2. Put a small GGUF instruct model in `models/llm/` and a Whisper GGML model in `models/whisper/`.
3. Copy `.env.example` to `.env` and adjust paths.
4. Run `scripts/start.sh` on macOS/Linux or `scripts/start.ps1` on Windows.
5. Open the local gateway at `http://127.0.0.1:8787/health`.
6. Open `web/index.html` for the minimal local chat console.

## API

- `GET /health` returns runtime state.
- `POST /v1/chat` accepts `{ "message": "..." }` and invokes the configured local llama server.
- `POST /v1/transcribe` accepts a local WAV body and invokes the configured local Whisper binary.

## Security model

- bind localhost by default
- no secrets in model directories
- no telemetry
- no remote inference in offline mode
- model downloads are intentionally a separate operator action
- production/cloud integration should use an authenticated D3VONN service rather than exposing this gateway directly

## Portable packaging roadmap

- [x] local gateway
- [x] local chat contract
- [x] local Whisper bridge
- [x] minimal web console
- [ ] signed platform binaries
- [ ] model manifest/checksums
- [ ] USB packaging
- [ ] hardware detection and accelerator profiles
- [ ] encrypted optional local memory
