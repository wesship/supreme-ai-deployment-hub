# ACE-Step 1.5 dependency review — pinned source

Pinned source revision: `ca1e85fe9430179831e6bc6be790c332190a3866`

The pinned upstream `pyproject.toml` declares the ACE-Step package under MIT and requires Python `>=3.11,<3.13`. The runtime dependency set includes PyTorch/TorchVision/TorchAudio, Transformers, Diffusers, Gradio, SciPy, SoundFile, Accelerate, FastAPI, Uvicorn, Numba, vector-quantize-pytorch, TorchCodec/TorchAO, PEFT, Lightning, ModelScope, and a local `nano-vllm` source package, among others.

This source-level review is not sufficient to mark `dependency_license_review` verified. Final verification must be performed against the exact resolved production environment/SBOM because several dependencies are version ranges or transitive packages, and `nano-vllm` is sourced from a local third-party directory.

Status: **pending exact-runtime SBOM review**.

Do not enable ACE-Step based on this document alone.
