# AquaGov Local GPU Worker API

This is an integration contract, not a claim that a GPU worker is currently deployed.

## Submit

`POST /api/aquagov/jobs`

```json
{
  "site_id": "SHO-001",
  "input_asset_id": "panorama-001",
  "pipeline": "matrix3d-wan-colmap-splat"
}
```

Expected response:

```json
{
  "job_id": "job-001",
  "status": "queued",
  "site_id": "SHO-001"
}
```

## Status

`GET /api/aquagov/jobs/:job_id`

```json
{
  "job_id": "job-001",
  "status": "running",
  "stage": "colmap",
  "progress": 0.67
}
```

Allowed stages:

1. `ingest`
2. `matrix3d`
3. `wan_reconstruction`
4. `panorama_reprojection`
5. `colmap`
6. `gaussian_splat`
7. `qa`
8. `publish`

## Publish

The worker should return a versioned asset manifest rather than only a file URL. The manifest must include the site, input asset, pipeline version, timestamps, evidence state, coordinate metadata, and output URI.

## Research guardrail

A completed GPU job does **not** imply `verified`. Reconstruction outputs remain `reconstructed` until a researcher reviews them. Synthetic/inferred regions must remain distinguishable from directly captured field evidence.
