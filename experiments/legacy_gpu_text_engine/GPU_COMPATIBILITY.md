# Legacy Quadro compatibility gate — not verified on hardware

The proposed Quadro K620 is Maxwell-generation hardware with 2 GB VRAM and compute capability 5.0 (confirm actual board identity using nvidia-smi and NVIDIA documentation before purchase). Modern CUDA releases do not support all legacy architectures. Do not use a current CUDA/PyTorch container by default or assume a specific old driver/toolkit combination is secure or supported.

Before activating any GPU backend:
1. Record PCI ID, model, compute capability, VRAM, power supply, host CPU/OS and driver version.
2. Establish a vendor-documented, pinned compatible CUDA C toolchain and compile a minimal kernel for the target SM.
3. Keep the legacy driver and compiler off production hosts; isolate worker network and permissions.
4. Verify CPU/GPU byte- and offset-exact parity on Unicode, empty, repeated and large corpora.
5. Measure transfer overhead, warm/cold latency, throughput, VRAM, energy and full host cost.
6. Reject the backend if parity fails or the maintenance/security cost outweighs the CPU baseline.
7. Treat 129 tokens/s in the demonstration as an unverified, model-specific result.

No CUDA backend, MCP server, or live hardware is activated by this document.
