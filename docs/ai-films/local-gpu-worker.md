# D3VONN AI Films local GPU worker

**Status:** non-production contract only. Generation must remain disabled until the hardware/runtime/model/artifact gates below are evidenced.

The API remains provider-neutral. A GPU host runs an operator-owned Wan or LTX wrapper and exposes its executable through an environment variable.

## Contract

- `D3VONN_WAN_VIDEO_RUNNER=/opt/d3vonn/bin/wan-run`
- `D3VONN_LTX_VIDEO_RUNNER=/opt/d3vonn/bin/ltx-run`

The wrapper accepts:

`--model MODEL --prompt PROMPT --output OUTPUT --width WIDTH --height HEIGHT --fps FPS --duration SECONDS`

and optionally `--input-image PATH --seed SEED`.

The wrapper must exit non-zero on failure and must create a non-empty output artifact on success.

## Security

Run model workers outside the web process with least-privilege service accounts. Do not put model credentials in film prompts or database records. Treat generated media as untrusted input and validate file type, size, duration, codec, and integrity before publication.

## Required activation evidence

Before connecting this contract to a dispatcher or queue, record and verify:

1. GPU identity and VRAM.
2. NVIDIA driver, CUDA runtime, PyTorch version, and `torch.cuda.is_available()`.
3. Exact model/checkpoint identifier, source revision, license review, and SHA-256 checksum.
4. Runner version/commit and deterministic command contract.
5. Single-shot smoke generation with fixed seed.
6. Output resolution, FPS, duration, codec, file size, and SHA-256.
7. Peak VRAM and generation duration.
8. Private artifact destination and successful upload/QC path.
9. Retry/failure behavior without treating partial files as completed assets.
10. Explicit production authorization after the above evidence is reviewed.

No checkpoint should be downloaded automatically by the web/API process, and no production dispatch should be inferred from this contract alone.
