# D3VONN Portable AI

Offline-first local AI runtime for D3VONN.IO. The portable bundle is designed to run from a local folder or USB drive on macOS, Linux, and Windows without requiring cloud AI APIs.

## Architecture

- `llama.cpp` / GGUF for local text generation
- `whisper.cpp` for offline speech-to-text
- Python standard-library HTTP gateway for a minimal dependency footprint
- explicit offline policy: cloud providers are disabled unless `D3VONN_OFFLINE=0`
- model files live outside source control under `models/`
- optional NVIDIA/Apple acceleration is selected by the underlying runtimes

## Quick start

1. Install `llama.cpp` and `whisper.cpp` binaries for the host platform.
2. Put a small GGUF instruct model in `models/llm/` and a Whisper GGML model in `models/whisper/`.
3. Copy `.env.example` to `.env` and adjust paths.
4. Run `scripts/start.sh` on macOS/Linux or `scripts/start.ps1` on Windows.
5. Open the local gateway at `http://127.0.0.1:8787/health`.

The gateway does not make outbound requests. In offline mode, any configured remote provider URL is rejected by policy.

## Security model

- bind localhost by default
- no secrets in model directories
- no telemetry
- no remote inference in offline mode
- model downloads are intentionally a separate operator action
- production/cloud integration should use an authenticated D3VONN service rather than exposing this gateway directly

## Directory

```text
portable-ai/
  bin/              # host binaries, not committed
  models/           # GGUF/GGML files, not committed
  config/           # runtime configuration
  gateway/          # local HTTP API
  scripts/          # launch and health helpers
```

## API

`GET /health` returns runtime state.

`POST /v1/chat` accepts `{ "message": "..." }` and invokes the configured local llama server.

The local gateway is deliberately small so it can later be embedded into the D3VONN desktop/mobile packaging without changing the API contract.
