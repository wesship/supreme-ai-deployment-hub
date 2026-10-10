# D3VONN Music Private GPU Runner Gate

This gate prepares a trusted self-hosted NVIDIA GPU runner for the `Music Private GPU Evidence` workflow without enabling any music provider.

## Required GitHub runner labels

The runner must be registered to `wesship/supreme-ai-deployment-hub` and carry all of these labels:

- `self-hosted`
- `linux`
- `d3vonn-gpu`

The evidence workflow targets exactly `[self-hosted, linux, d3vonn-gpu]`.

## Qualification root

Choose a dedicated non-root directory owned by the runner service account, for example:

```bash
/opt/d3vonn/music-qualification
```

Export it to the runner service environment as:

```bash
MUSIC_QUALIFICATION_ROOT=/opt/d3vonn/music-qualification
```

Keep model artifacts and the runtime SBOM under that root. The workflow resolves real paths and rejects paths that escape it.

Suggested layout:

```text
/opt/d3vonn/music-qualification/
  models/
    ace-step-1.5/
      ... pinned model files ...
  sbom/
    ace-step-runtime.cdx.json
```

Do not place GitHub tokens, API keys, `.env` files, SSH keys, or unrelated host data under the qualification root.

## Preflight

On the trusted GPU host, from a clean checkout of `main`, run:

```bash
export MUSIC_QUALIFICATION_ROOT=/opt/d3vonn/music-qualification
bash scripts/music-gpu-runner-preflight.sh
```

The preflight is read-mostly. It verifies Linux runner prerequisites, Node, Python, Git, `nvidia-smi`, PyTorch CUDA availability, and write access to the dedicated qualification root. It does not install software, download weights, start containers, or activate a provider.

## Evidence inputs

Before dispatching the workflow, have these three values ready:

1. `model_root`: absolute path to the pinned ACE-Step 1.5 model directory under `MUSIC_QUALIFICATION_ROOT`.
2. `runtime_image_ref`: immutable container reference in `name@sha256:<64-hex>` form.
3. `sbom_path`: absolute path to the CycloneDX JSON for that exact image, also under `MUSIC_QUALIFICATION_ROOT`.

The repository currently pins ACE-Step source and model revisions in the workflow. The evidence job also verifies the provider remains `PENDING_EXTERNAL_EVIDENCE` with `production_enabled: false`.

## Dispatch boundary

Dispatch `Music Private GPU Evidence` from `main` only, using the repository-owner account. Do not dispatch from a feature branch. Do not change the provider state before the evidence artifact has been reviewed.

A successful run uploads a redacted review bundle containing model aggregate/hash metadata, runtime/SBOM summary information, GPU/runtime metadata, and `PENDING_REVIEW` status. It does not publish model files or the raw SBOM and does not enable production generation.

## Pass criteria

This gate is complete only when:

- the preflight script passes on the intended host;
- GitHub shows the `d3vonn-gpu` runner online and idle before dispatch;
- the manual evidence workflow completes successfully from `main`;
- the uploaded review artifact has been inspected;
- unresolved license findings, if any, are dispositioned by a human reviewer;
- ACE-Step remains disabled until the later controlled-generation gate is explicitly approved.
