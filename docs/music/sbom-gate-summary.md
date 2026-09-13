# SBOM gate summary

After this gate is merged, generate CycloneDX on the trusted qualification host from the exact digest-pinned ACE-Step runtime image and process it with the runtime SBOM evidence script. Upstream manifests, development environments, mutable tags, and CI fixtures are not production evidence. The provider remains disabled until the full qualification contract passes.
