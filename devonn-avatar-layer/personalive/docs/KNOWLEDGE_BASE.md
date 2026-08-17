# PersonaLive — Technical Knowledge Base

## Overview

PersonaLive is a real-time, streamable diffusion framework for generating infinite-length portrait animations, published at CVPR 2026 by researchers from the University of Macau, Dzine.ai, and GVC Lab at Great Bay University. It represents the current state-of-the-art in live-streaming portrait animation, capable of running on consumer GPUs with as little as 12GB VRAM.

The framework takes a single reference portrait image and a driving signal (webcam feed, audio, or pre-recorded video) to produce expressive, photorealistic animated output in real-time. This makes it ideal for digital human applications where an AI agent needs a visual presence.

## License

**Apache License 2.0** — permissive open-source license that allows commercial use, modification, distribution, and private use. Compatible with Devonn.AI's deployment model.

## Technical Architecture

PersonaLive employs a multi-component diffusion pipeline built on Stable Diffusion foundations.

| Component | Purpose | File |
|-----------|---------|------|
| Denoising UNet | Core diffusion backbone for image generation | `denoising_unet.pth` |
| Motion Encoder | Encodes facial motion from driving signal | `motion_encoder.pth` |
| Motion Extractor | Extracts motion features from input frames | `motion_extractor.pth` |
| Pose Guider | Guides head pose and orientation | `pose_guider.pth` |
| Reference UNet | Encodes identity from reference portrait | `reference_unet.pth` |
| Temporal Module | Ensures frame-to-frame coherence for streaming | `temporal_module.pth` |

## Performance Characteristics

| Metric | Value | Notes |
|--------|-------|-------|
| Minimum VRAM | 12 GB | With streaming generation strategy |
| Recommended VRAM | 24 GB+ | For best quality and latency |
| Inference Speed (xFormers) | ~10-15 FPS | Depends on GPU |
| Inference Speed (TensorRT) | ~20-30 FPS | ~2x speedup over xFormers |
| Output Resolution | 512x512 | Standard portrait resolution |

## REST API (neosun100 Production Fork)

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/health` | GET | Service health check |
| `/api/gpu/status` | GET | GPU utilization and memory status |
| `/api/process/offline` | POST | Process reference image + driving video |
| `/docs` | GET | Swagger/OpenAPI documentation |

## Source References

- **Official Repository:** https://github.com/GVCLab/PersonaLive
- **Production Fork (REST API):** https://github.com/neosun100/PersonaLive
- **Paper (ArXiv):** https://arxiv.org/abs/2512.11253
- **Model Weights (HuggingFace):** https://huggingface.co/huaichang/PersonaLive
- **Docker Image:** `neosun/personalive:allinone`
