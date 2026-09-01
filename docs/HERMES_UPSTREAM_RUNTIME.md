# Hermes Agent upstream runtime gate

## Pinned release

D3VONN's optional upstream Hermes Agent runtime is pinned to the official Nous
Research release below. Both the release tag and its peeled commit are checked;
a movable tag alone is not trusted.

| Field | Value |
|---|---|
| Repository | `https://github.com/NousResearch/hermes-agent.git` |
| Release | `v0.20.6` |
| Tag | `v2026.8.27` |
| Commit | `5fc308a70719a83cccdbba4c0e39c23f5a8239d5` |
| Python | `>=3.11,<3.14` |

## What the gate does

`deploy/vps/scripts/update-hermes-upstream.sh` clones the trusted repository at
the exact tag, verifies the commit and package version, and requires the
upstream `uv.lock`. It installs the curated `all` extra with `uv sync --locked`,
then checks the installed Python version, CLI banner, and configuration command
using an isolated `HERMES_HOME`.

Each immutable release is built under
`$HERMES_UPSTREAM_ROOT/releases/<commit>`. After every check passes, the script
atomically advances `$HERMES_UPSTREAM_ROOT/staged`. It does not create or modify
`current`, restart a process, deploy to a VPS, or connect upstream Hermes to the
D3VONN task API.

## Operator staging

Run this only in an authorized VPS session with `git`, `uv`, and Python 3.11+
already installed:

```bash
set -a
source deploy/vps/hermes-upstream.env.example
set +a
deploy/vps/scripts/update-hermes-upstream.sh
```

Treat the resulting `staged` release as a candidate. Production promotion must
remain a separate, reviewed operation after credentials, resource limits,
network policy, rollback, and the D3VONN adapter have been validated.

## Evidence boundary

The GitHub workflow proves that a clean runner can fetch the pinned public
source, perform a lock-enforced install, and execute the CLI checks. It does not
prove that a particular VPS was changed or that a production Hermes worker is
live. Those claims require evidence from the target host.
