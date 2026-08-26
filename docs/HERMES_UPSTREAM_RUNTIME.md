# D3VONN.IO — Upstream Nous Hermes Runtime

## Decision

D3VONN keeps its proprietary `backend/hermes` control plane as the canonical orchestration layer. The upstream Nous Research Hermes Agent is treated as a separately pinned execution/runtime layer.

This avoids replacing D3VONN's agent registry, policy routing, memory contracts, worker leases, and security controls while allowing D3VONN to consume upstream Hermes improvements.

## Current upstream pin

- Repository: `https://github.com/NousResearch/hermes-agent`
- Stable tag: `v2026.8.19`
- Hermes version: `0.20.5`
- Release date: August 19, 2026

The pin was verified against the upstream GitHub latest-release page on August 25, 2026.

## Compatibility status

The upstream runtime is **staged, not production-wired**. See `docs/HERMES_V0_20_5_COMPATIBILITY_MATRIX.md` for the required gates before adapter integration.

## Update procedure

On the VPS, source the environment values and run:

```bash
export HERMES_UPSTREAM_REPO=https://github.com/NousResearch/hermes-agent.git
export HERMES_UPSTREAM_TAG=v2026.8.19
export HERMES_UPSTREAM_INSTALL_DIR=/opt/d3vonn/hermes-agent
bash deploy/vps/scripts/update-hermes-upstream.sh
```

The updater checks out the exact release tag, installs the `[all]` extras into a dedicated virtual environment, prints `hermes --version`, and runs `hermes config check`.

## Production guardrail

Do **not** replace the existing `d3vonn-hermes` Docker service with the upstream process until the compatibility test suite confirms the upstream runtime can safely sit behind the D3VONN control plane. The current Docker service runs `python -m hermes.worker` and implements D3VONN task polling, dispatch, leases, and restart recovery.

The intended final architecture is:

`D3VONN control plane → policy/registry/security → upstream Nous Hermes runtime → tools/providers`

This is an integration upgrade, not a wholesale replacement.