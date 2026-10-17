# D3VONN Pocket Node v0.1

Portable, offline-first personal AI node for removable SSD storage.

## Modes

- `AIRGAP`: loopback-only inference; no network bridge.
- `LOCAL`: local inference plus explicitly configured trusted LAN services.
- `BRIDGE`: authenticated D3VONN/Hermes integration.
- `MAINTENANCE`: controlled model/runtime updates.

Default mode is `AIRGAP`.

## Security invariants

1. AI inference binds to `127.0.0.1` by default.
2. Cloud telemetry is disabled by default.
3. Agent shell/process execution is disabled unless explicitly enabled by policy.
4. BRIDGE requires an explicit endpoint and token supplied through the host environment; credentials are never committed to the drive manifest.
5. Integrity checks use SHA-256 manifests before launch.
6. User documents and generated indexes remain under the removable drive root.

## Layout

```text
pocket-node/
  config/
  launch/
  scripts/
  tests/
```

Runtime data on the removable drive:

```text
D3VONN_POCKET/
  models/{general,coding,embeddings,speech}
  memory/{vectors,knowledge-graph,conversations,checkpoints}
  rag/{documents,indexes}
  workspace/{repos,projects,exports}
  vault/
  logs/
```

## Bootstrap

macOS/Linux:

```bash
bash pocket-node/scripts/bootstrap.sh /Volumes/D3VONN_POCKET
```

The bootstrapper creates the runtime directories and a local `.env` from `.env.example`. It does not download models or executables automatically; binaries and GGUF files should be sourced from trusted upstream releases and then added to the integrity manifest.

## Launch

```bash
D3VONN_POCKET_ROOT=/Volumes/D3VONN_POCKET bash pocket-node/launch/start.sh
```

The launcher validates mode/configuration and then starts a configured local `llama-server` executable on loopback. BRIDGE mode fails closed when endpoint/token configuration is absent.

## Acceptance gates

- bootstrap is idempotent
- AIRGAP launches without a bridge configuration
- BRIDGE fails closed without credentials
- inference host defaults to loopback
- manifest verification fails on modified artifacts
- no secrets are stored in tracked files
- runtime data stays under `D3VONN_POCKET_ROOT`

Model downloads, OS-level full-disk encryption, firewall rules, and hardware/GPU verification are host provisioning steps and are intentionally not claimed as completed by this repository code.
