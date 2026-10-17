# Optional CUDA C prototype — hardware gate remains closed

This is a minimal byte-exact, case-sensitive ASCII substring matcher. It is **not** equivalent to the Python engine's Unicode-aware case-insensitive search, does not perform Markov generation, and must not be wired into Hermes or called a drop-in accelerator.

To build on an isolated, validated legacy NVIDIA host, select a pinned CUDA toolkit supporting the actual GPU compute capability, then compile with an appropriate `-gencode` value. Example for a confirmed sm_50 board (only if toolkit supports it): `nvcc -O2 -gencode arch=compute_50,code=sm_50 substring.cu -o substring`.

Manual smoke: `./substring 'alpha beta alpha' 'alpha'` should print offsets 0 and 11. The process returns nonzero on CUDA errors. This prototype accepts command-line strings only and is not suitable for large private corpora because arguments can be exposed in process listings.

**Before use:** replace argv ingestion with a bounded private input protocol, add cleanup on failure, test Unicode/casefold parity or explicitly reject unsupported requests, verify security and throughput, and implement safe CPU fallback. No GPU testing has been performed.
