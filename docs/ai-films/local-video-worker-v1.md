# AI Films Local Video Worker v1

## Target

Use the official Wan2.2 TI2V-5B model as the first D3VONN-owned local video provider.

Wan2.2 documents TI2V-5B as supporting text-to-video and image-to-video at 720p/24fps and running on a single 24GB GPU such as an RTX 4090.

## Production gate

- [ ] Dedicated GPU worker host verified
- [ ] NVIDIA driver/CUDA stack verified
- [ ] PyTorch >= 2.4 verified
- [ ] Wan2.2 TI2V-5B weights downloaded from the official distribution
- [ ] Text-to-video smoke test succeeds
- [ ] Image-to-video smoke test succeeds
- [ ] Output is valid MP4 with expected codec/container
- [ ] Artifact checksum and immutable job ID recorded
- [ ] Worker health/readiness endpoint implemented
- [ ] Job timeout/cancellation implemented
- [ ] Retry policy implemented without duplicate generation
- [ ] D3VONN storage handoff verified
- [ ] FFmpeg assembly handoff verified
- [ ] QA gate verifies duration, dimensions, frame rate and decodeability
- [ ] Benchmark records latency, VRAM peak, failures and output quality
- [ ] Provider is marked `production` only after all gates pass

## Initial operating profile

- Model: `Wan-AI/Wan2.2-TI2V-5B`
- Modes: text-to-video and image-to-video
- Initial target: 1280x704 landscape / 704x1280 portrait
- Initial frame rate: 24 fps
- Initial worker concurrency: 1 job per 24GB GPU
- OOM fallback: lower resolution before increasing concurrency

## Safety

Do not claim unlimited throughput. Capacity depends on GPU generation time, thermal limits, storage, queue depth and model configuration. Do not expose model credentials or host credentials to clients.
