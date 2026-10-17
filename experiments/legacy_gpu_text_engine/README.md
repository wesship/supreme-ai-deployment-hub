# Legacy GPU Text Engine — CPU reference (Gate 3)

This isolated experiment has no GPU, external model, network, or runtime service dependencies. It provides literal case-insensitive search with exact Python character offsets, vocabulary counts, adjacent word transitions and simple URL/year extraction.

Run from this directory: `python -m unittest -v test_engine.py`.

Limitations: linear scan, no persistence, no embeddings, no named-entity model, no Markov generation, no MCP endpoint, and no CUDA implementation. Tokenization is approximate. URL punctuation may need cleanup. The benchmark claims in the Vectorfall video are not reproduced. No production activation is authorized.

Next: add deterministic generated-text provenance, explicit source offsets for transitions, benchmarks, and a separately pinned optional legacy CUDA backend.
