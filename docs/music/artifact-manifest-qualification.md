# Music provider artifact-manifest qualification

This gate creates reviewable SHA-256 evidence from an already-downloaded, pinned provider artifact directory. It does **not** download models, start GPU compute, modify the provider registry, or authorize production activation.

## ACE-Step 1.5 procedure

Use the exact pinned ACE-Step 1.5 model revision already recorded in `config/music/providers.json`. On the approved qualification host, after the pinned artifacts are present locally, run:

```bash
node scripts/music-provider-artifact-manifest.mjs \
  --provider ace-step-1.5 \
  --root /absolute/path/to/pinned/model/artifacts \
  --out /secure/evidence/ace-step-1.5-artifact-manifest.json
```

The output path must be outside the artifact root and must not already exist. The tool hashes every logical file under the artifact root, including file-backed symlinks, sorts entries by logical path, and derives an aggregate SHA-256 from each file SHA-256, byte size, and logical path.

## Review requirements

Before copying the aggregate digest into production qualification evidence, a reviewer must confirm:

1. the host downloaded the exact registry `model_revision`, not a moving branch/tag;
2. the manifest provider/source/model revisions match the registry;
3. the artifact root corresponds to the files actually loaded by the runtime;
4. the manifest contains all loaded weight/checkpoint artifacts;
5. the manifest was produced before the private-GPU smoke test and retained with the test evidence;
6. the exact runtime SBOM/dependency-license review is completed separately.

Do not change `weights_sha256`, `artifact_hash_status`, provider approval, hosted/commercial flags, or `enabled` merely because the script produced a digest. Those changes require reviewed evidence and the existing fail-closed qualification gates.
