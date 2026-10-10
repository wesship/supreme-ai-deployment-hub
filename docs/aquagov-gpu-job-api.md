# AquaGov GPU Job API Contract

## Purpose

Define a provider-neutral HTTP contract between AquaGov and a future local GPU worker. The API can be implemented by a local workstation, LAN service, or later queue without coupling the browser to Matrix-3D, Wan 2.1, COLMAP, or a particular splat trainer.

## Endpoints

### POST `/api/aquagov/jobs`

Creates a reconstruction job.

Request:

```json
{
  "site_id": "SHO-001",
  "asset_id": "asset-uuid",
  "input_uri": "local://captures/SHO-001/pano.jpg",
  "input_kind": "panorama",
  "requested_outputs": ["synthetic-flythrough", "colmap", "gaussian-splat"]
}
```

Response:

```json
{
  "job_id": "job-uuid",
  "status": "queued",
  "site_id": "SHO-001",
  "asset_id": "asset-uuid"
}
```

### GET `/api/aquagov/jobs/{job_id}`

Returns current state and output references.

```json
{
  "job_id": "job-uuid",
  "status": "running",
  "progress": 0.42,
  "stage": "colmap",
  "outputs": {}
}
```

### POST `/api/aquagov/jobs/{job_id}/cancel`

Requests cancellation. Workers must treat cancellation as cooperative and report the terminal state explicitly.

## State machine

```text
queued → running → review → complete
   │        │
   └────────┴────→ failed

queued/running → cancelled
```

Only QA/research review can transition an asset's evidence state to `verified`. A worker may never perform that transition automatically.

## Stages

1. `preflight`
2. `matrix3d`
3. `wan21`
4. `reprojection`
5. `colmap`
6. `splat-training`
7. `qa`
8. `publish`

A worker may skip stages only when the requested output does not require them, and must record the actual stages executed.

## Security boundary

The API must not accept arbitrary shell commands from the browser. Inputs are structured job fields. Worker implementations must resolve `input_uri` through an allowlisted storage scheme and keep generated artifacts in an isolated workspace.

## Research provenance

The job contract carries `site_id` and `asset_id` so every generated artifact remains traceable to its field source. Generated outputs are `reconstructed` or `inferred` until independently reviewed.

## Local-first deployment

The initial implementation can run entirely on a local machine:

```text
AquaGov browser
      ↓ localhost/LAN HTTP
GPU worker
      ↓
local artifact directory
```

No cloud upload is required by this contract.

## Acceptance criteria

- Job creation is idempotency-ready via client-supplied asset/job correlation.
- Every job has a stable job ID.
- State transitions are explicit.
- Progress identifies the current pipeline stage.
- Outputs are references, not inline binary payloads.
- Worker cannot mark research evidence verified.
- Browser cannot execute arbitrary worker commands.
- The same contract works with a future remote GPU worker.
