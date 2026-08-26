# D3VONN AI Films — RTX 4090 Validation Runbook

## Purpose

Validate the first real local GPU generation path on an NVIDIA RTX 4090 before enabling unattended film rendering.

## Target

- GPU: NVIDIA RTX 4090 (24 GB VRAM)
- OS: Linux recommended
- Runtime: pinned CUDA/PyTorch environment from the selected Wan/LTX runner
- Worker: D3VONN local video worker

## Gate 0 — host checks

```bash
nvidia-smi
python -c "import torch; print(torch.cuda.is_available()); print(torch.cuda.get_device_name(0) if torch.cuda.is_available() else 'NO CUDA')"
```

Expected: CUDA available and an RTX 4090 reported.

## Gate 1 — worker configuration

Configure the local runner commands without committing secrets:

```bash
export D3VONN_WAN_WORKER_COMMAND=/opt/d3vonn/bin/wan-run
export D3VONN_LTX_WORKER_COMMAND=/opt/d3vonn/bin/ltx-run
```

The commands must accept `--packet <path> --output <path>` and write a non-empty MP4 to the requested output path.

## Gate 2 — controlled shot

Use a single 10-second 16:9 720p test shot. Record:

- model/checkpoint identifier and license
- seed
- generation duration
- peak VRAM
- output resolution/FPS/duration
- output SHA256
- worker exit code

Do not publish the generated test asset until its model/checkpoint license has been verified.

## Gate 3 — queue integration

Submit one render job through the D3VONN render-job path and verify:

`queued -> processing -> completed`

On runner failure, verify:

`processing -> failed`

and ensure no orphaned output is treated as a completed asset.

## Gate 4 — storage/QC

Validate the MP4, upload it to private project storage, and run continuity/media checks before marking the shot production-ready.

## Gate 5 — five-minute Alpha

Only after the single-shot test passes, generate a small multi-shot short film and validate scene continuity, audio, FFmpeg assembly, and final-master integrity.

## Safety

Keep GPU workers private. Never commit Supabase tokens, model credentials, or private storage URLs. Keep generation disabled until the host has passed the controlled test.