# AquaGov GPU Workstation Bootstrap

## Supported baseline

The current Matrix-3D upstream path is Linux + NVIDIA. Its repository documents Python 3.10 and CUDA 12.4-compatible PyTorch, while SplatKit supplies the ComfyUI dataset workflow and its own SphereSfM binary. Do not treat this document as a claim that every GPU will work.

## Preflight

Before installation, record:

```bash
nvidia-smi
python3 --version
python3 -m pip --version
df -h
```

The worker should refuse jobs when GPU visibility, disk space, or required model/node manifests do not satisfy the pinned profile.

## Components

```text
NVIDIA driver
  ↓
Python 3.10 / isolated environment
  ↓
ComfyUI
  ↓
ComfyUI-SplatKit
  ├── MoGe
  ├── SphereSfM
  └── RAFT weights
  ↓
WAN 2.1 i2v checkpoint
  ↓
Matrix-3D panorama LoRA
  ↓
COLMAP dataset
  ↓
chosen Gaussian Splat trainer
  ↓
AquaGov worker
```

## Installation contract

Pin repository commits and model identifiers in a machine manifest before downloading weights. Never let a production job implicitly select `main` or an unpinned model.

Matrix-3D's upstream installer currently installs its native dependencies and documents CUDA/PyTorch requirements. SplatKit has its own requirements and downloads MoGe/SphereSfM/RAFT assets on first use. Keep these environments isolated unless compatibility has been explicitly verified.

## Worker configuration

```text
AQUAGOV_API_URL=https://<approved-api>
AQUAGOV_WORKER_ID=<registered-worker-id>
AQUAGOV_WORKER_TOKEN=<secret-from-secret-store>
AQUAGOV_WORKSPACE=/srv/aquagov/workspace
AQUAGOV_DRY_RUN=false
COMFYUI_URL=http://127.0.0.1:8188
```

Never commit the worker token or model credentials.

## Validation sequence

1. NVIDIA driver/GPU visible.
2. CUDA/PyTorch can initialize the GPU.
3. ComfyUI starts and its API endpoint responds.
4. Required custom nodes load without errors.
5. Required model/checkpoint files exist and hashes match the pinned manifest.
6. Approved SplatKit workflow validates.
7. A tiny smoke workflow succeeds.
8. AquaGov worker registers and heartbeats.
9. AquaGov dry-run job succeeds.
10. Only then enable real reconstruction jobs.

## VRAM policy

Do not hard-code one GPU requirement into AquaGov. Matrix-3D documents substantially different VRAM requirements by model/resolution and provides low-VRAM modes; the worker should select a pinned profile based on detected hardware rather than guessing.

## Provenance

Record GPU, driver, CUDA/PyTorch versions, Matrix-3D/SplatKit commits, model hashes, workflow hash, and worker version with every real reconstruction. Generated geometry remains `reconstructed` until independent research review.
