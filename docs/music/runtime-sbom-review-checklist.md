# Music runtime SBOM review checklist

Use this checklist only with evidence generated from the exact digest-pinned runtime image.

- Confirm provider ID and immutable source/model revisions match `config/music/providers.json`.
- Confirm `runtime_image_ref` ends in the expected image SHA-256 digest.
- Independently hash the retained CycloneDX file and match `sbom_sha256`.
- Review every component with missing license metadata; do not treat missing metadata as permissive licensing.
- Confirm model/runtime bundles and embedded components are represented, including ACE-Step's Qwen3 embedding dependency.
- Review copyleft, source-availability, non-commercial, research-only, attribution, notice, patent, and redistribution obligations.
- Retain notices/attributions required by dependencies in the distributable runtime where applicable.
- Record reviewer identity/date separately from generated evidence.
- Do not set `dependency_license_review=verified` until the exact runtime inventory is complete.
- Do not enable a music provider from this review alone; GPU smoke, deterministic generation, audio QA, provenance, artifact digest, and production certification gates remain mandatory.
