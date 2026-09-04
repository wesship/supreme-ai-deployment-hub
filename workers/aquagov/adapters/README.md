# GPU Pipeline Adapters

## Matrix-3D

The current upstream Matrix-3D project supports image-to-panorama and panorama-video generation. Its documented Linux/NVIDIA setup uses Python 3.10 and CUDA 12.4-era PyTorch. The 5B panorama-video model has a documented low-VRAM path around 12 GB, while the full pipeline has higher requirements.

The AquaGov adapter intentionally validates the local installation and returns an argv array. It does not invoke shell commands, download checkpoints, or silently change CUDA/model versions.

Reference: https://github.com/SkyworkAI/Matrix-3D

## Future adapters

- Wan 2.1 i2v
- panorama reprojection
- COLMAP / SphereSfM
- Gaussian Splat trainer

Each adapter must expose validation, structured arguments, outputs, and version metadata.
