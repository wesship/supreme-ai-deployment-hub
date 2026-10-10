# ACE-Step 1.5 pinned-source review

Reviewed source revision: `ca1e85fe9430179831e6bc6be790c332190a3866`.

The pinned upstream package declares version `1.5.0`, MIT licensing, and Python `>=3.11,<3.13`. Linux x86_64 uses CUDA 12.8 PyTorch packages in the upstream dependency definition; Linux aarch64 uses CUDA 13.0 packages. The production qualification target must therefore record its actual architecture, CUDA/driver stack, Torch version, and resolved dependency SBOM rather than assuming compatibility from the model name alone.

This review does not authorize production activation or paid GPU spend.
