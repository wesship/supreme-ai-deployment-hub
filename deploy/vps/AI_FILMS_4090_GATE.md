# D3VONN AI Films — RTX 4090 Acceptance Gate

Run on the physical RTX 4090 host before enabling generation:

```bash
bash deploy/vps/ai-films-4090-preflight.sh
```

## Required result

- `nvidia-smi` detects an NVIDIA RTX 4090.
- PyTorch is installed and reports `torch.cuda.is_available() == True`.
- PyTorch reports the expected CUDA device.
- Docker daemon is reachable.

## Generation gate

Keep:

```text
AI_FILM_GENERATION_EXECUTION_ENABLED=false
```

until the exact model/checkpoint license, checksum, runtime version, private storage destination, and operator-owned runner have been reviewed.

Then enable execution only for a single controlled test job:

- 1 shot
- 10 seconds
- 16:9
- 720p target
- deterministic seed

Record model/checkpoint + version, license decision reference, SHA-256, runner version, CUDA/PyTorch versions, seed, generation duration, peak VRAM, output resolution/FPS/duration/codec, output SHA-256, upload result, and QC result.

Only after that evidence passes review should queue/dispatcher integration or multi-shot jobs be considered.
