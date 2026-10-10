# ACE-Step exact-runtime SBOM gate

This gate captures dependency evidence from the exact immutable container image intended for private ACE-Step 1.5 qualification. It does not approve a provider and must not enable production routing.

## 1. Build and pin the runtime image

Build the intended private runtime image using the pinned ACE-Step source/model revisions. Resolve the resulting image to a digest and use only a reference ending in `@sha256:<64-hex>` for qualification. Mutable tags such as `latest` are not acceptable evidence.

## 2. Generate CycloneDX from the exact image

On the trusted qualification host, use an approved SBOM scanner against that digest-pinned image. Example with Syft:

```bash
syft 'registry.example/ace-step@sha256:<digest>' -o cyclonedx-json=ace-step.runtime.cdx.json
```

Do not commit the production image, credentials, private registry tokens, or generated evidence containing sensitive registry metadata.

## 3. Normalize evidence

```bash
node scripts/music-runtime-sbom-evidence.mjs \
  --provider ace-step-1.5 \
  --image-ref 'registry.example/ace-step@sha256:<digest>' \
  --sbom ace-step.runtime.cdx.json \
  --out ace-step.runtime-evidence.json
```

The evidence tool binds the SBOM to the provider's immutable source/model revisions, records the exact image digest and SBOM SHA-256, sorts components deterministically, and lists every component for which the scanner supplied no license information. Existing output is never overwritten.

## 4. Human license review

`review_status` is always emitted as `PENDING_REVIEW`. The tool never marks dependency licensing verified. A reviewer must resolve every unknown license, inspect bundled model/runtime components (including the Qwen3 embedding dependency), and compare the evidence with the actual runtime image before `dependency_license_review` can become `verified`.

## Exit criteria

This gate passes only when the exact digest-pinned runtime image has a retained SBOM and evidence file, all unresolved licenses have been reviewed, prohibited/incompatible licenses have been addressed, and reviewer approval is recorded. Artifact hashing, private-GPU smoke testing, deterministic generation, audio QA, provenance, and production certification remain separate gates. ACE-Step must remain disabled until all gates pass.
