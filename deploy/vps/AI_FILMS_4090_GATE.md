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

After preflight passes, configure the pinned Wan/LTX runner commands and keep:

```text
AI_FILM_GENERATION_EXECUTION_ENABLED=false
```

until the model/checkpoint license, checksum, runtime version, and storage destination have been reviewed.

Then enable execution for a single controlled test job:

- 1 shot
- 10 seconds
- 16:9
- 720p target
- deterministic seed

Record:

- model/checkpoint + version
- runtime version
- seed
- generation duration
- peak VRAM
- output resolution/FPS/duration
- output SHA-256
- queue state transitions
- upload result
- QC result

Only after that passes should the worker be admitted to multi-shot/film jobs.
