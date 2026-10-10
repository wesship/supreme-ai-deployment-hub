# D3VONN Portable AI

D3VONN Portable AI is a small, offline-only gateway for a locally managed `llama.cpp` server and optional `whisper.cpp` transcription. It is designed for a local folder or removable drive on macOS, Linux, and Windows. It does not activate a cloud service or download a model.

## Trust boundary

- The gateway binds only to an explicit loopback IP literal (`127.0.0.1` or `::1`). Wildcard, LAN, and hostname binds fail closed.
- The llama endpoint must also be an explicit HTTP(S) loopback IP. Redirects and environment HTTP proxies are disabled.
- Browser requests require an exact loopback `Host` and same-origin `Origin`, limiting DNS-rebinding and cross-site request attacks.
- Requests and upstream responses have bounded sizes and timeouts. Only one inference or transcription operation runs at a time.
- `.env` is parsed as data by Python. Neither launcher sources nor executes it.
- Error responses omit subprocess output, paths, and internal exception details.
- The runtime emits no telemetry and has no cloud inference mode. `D3VONN_OFFLINE` must equal `1`.

This protects the gateway boundary; it does not attest third-party binaries or models. Operators must verify downloads and licensing before use.

## Requirements

- Python 3.10 or newer
- a separately installed, locally listening OpenAI-compatible `llama.cpp` server
- optional `whisper-cli` plus a local Whisper model

No Python package installation is required.

## Start

1. Copy `.env.example` to `.env` and adjust only the local paths and ports you need.
2. Start `llama-server` on the exact loopback address configured by `D3VONN_LLAMA_URL`.
3. Run `scripts/start.sh` on macOS/Linux or `scripts/start.ps1` on Windows.
4. Open `http://127.0.0.1:8787/`. The console is served by the gateway so it remains same-origin.

## API

- `GET /health` reports gateway policy/configuration state. It does not claim that the model is loaded.
- `POST /v1/chat` requires `application/json` with `{ "message": "..." }`.
- `POST /v1/transcribe` accepts `audio/wav`, `audio/x-wav`, or `application/octet-stream`.

## Deliberate non-goals for this gate

- downloading or redistributing model weights
- signed platform installers or auto-update
- exposing the gateway to a LAN, tunnel, or public hostname
- cloud fallback, telemetry, authentication, or D3VONN production connectivity
- claiming hardware certification without a physical-device canary

Those require separate provenance, packaging, authentication, and hardware gates.
