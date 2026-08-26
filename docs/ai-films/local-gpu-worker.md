# D3VONN AI Films local GPU worker

The API remains provider-neutral. A GPU host runs an operator-owned Wan or LTX wrapper and exposes its executable through an environment variable.

## Contract

- `D3VONN_WAN_VIDEO_RUNNER=/opt/d3vonn/bin/wan-run`
- `D3VONN_LTX_VIDEO_RUNNER=/opt/d3vonn/bin/ltx-run`

The wrapper accepts:

`--model MODEL --prompt PROMPT --output OUTPUT --width WIDTH --height HEIGHT --fps FPS --duration SECONDS`

and optionally `--input-image PATH --seed SEED`.

The wrapper must exit non-zero on failure and must create a non-empty output artifact on success.

## Security

Run model workers outside the web process with least-privilege service accounts. Do not put model credentials in film prompts or database records. Treat generated media as untrusted input and validate file type/size before publishing.

## Production progression

1. Run Wan 2.2 TI2V-5B locally for the Alpha short-film benchmark.
2. Add LTX-2.x as the audio/video worker.
3. Connect workers to the existing film generation dispatcher/queue.
4. Add continuity QC and deterministic FFmpeg assembly.
5. Record generation telemetry for later D3VONN accelerator profiling.
