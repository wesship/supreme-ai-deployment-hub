# AquaGov GPU Worker

Provider-neutral local worker skeleton for the AquaGov reconstruction queue.

## Lifecycle

`authenticate → heartbeat → claim → execute adapter → report → complete`

The current runtime is **dry-run only**. It does not invoke Matrix-3D, Wan 2.1, ComfyUI, COLMAP, or a splat trainer. Those integrations belong behind pipeline adapters.

## Configuration

```text
AQUAGOV_API_URL
AQUAGOV_WORKER_ID
AQUAGOV_WORKER_TOKEN
AQUAGOV_POLL_SECONDS=10
AQUAGOV_WORKSPACE=./workspace
AQUAGOV_DRY_RUN=true
```

## Security

- Keep worker tokens outside source control.
- Do not pass arbitrary shell commands from the API to the worker.
- Pipeline adapters must use an allowlisted executable/configuration.
- Treat downloaded field imagery as untrusted input and process it in an isolated workspace.

## Adapter boundary

```text
Job
 ↓
PipelineAdapter.run(job, workspace)
 ↓
Artifact manifest
```

The adapter returns structured artifacts and metadata. The worker itself owns queue lifecycle and never upgrades evidence provenance to `verified`.
