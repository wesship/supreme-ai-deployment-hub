# Runtime SBOM evidence safety boundary

The runtime SBOM tooling is evidence-only. It accepts an already-generated CycloneDX document and a digest-pinned image reference, then emits deterministic review material. It does not pull container images, authenticate to registries, install scanners, download model weights, start GPU workloads, change qualification records, or enable a provider.

Generated evidence must remain `PENDING_REVIEW`. License metadata reported by an automated scanner is an input to review, not legal approval. Production activation requires the separate qualification and certification gates already defined for Music Hub.
