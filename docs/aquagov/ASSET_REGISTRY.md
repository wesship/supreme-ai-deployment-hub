# AquaGov Asset Registry

The Asset Registry is the boundary between field evidence, GIS, and local GPU reconstruction. A 3D result must never be represented as observed evidence merely because a reconstruction completed.

## Asset lifecycle

`draft → queued → running → review → complete`

Failure is terminal for a job attempt: `failed`. A retry creates a new job attempt rather than silently overwriting provenance.

## Asset types

- `panorama` — original field capture; evidence defaults to `observed`.
- `matrix3d` — AI reconstruction generated from a panorama/image.
- `wan_video` — AI-generated exploration/reconstruction video.
- `colmap` — camera/point dataset produced for downstream splat training.
- `gaussian_splat` — trained 3D Gaussian Splat asset.

## Evidence states

- `observed` — directly captured in the field.
- `reconstructed` — generated from captured evidence.
- `inferred` — analytical or model-derived content not directly observed.
- `verified` — reviewed by a researcher against available evidence.

## GPU job contract

A job request contains:

```json
{
  "job_id": "job-...",
  "site_id": "SHO-001",
  "input_asset_id": "panorama-...",
  "pipeline": "matrix3d-wan-colmap-splat",
  "status": "queued",
  "requested_at": "2026-08-26T00:00:00Z"
}
```

The web application submits metadata only. GPU workers own Matrix-3D, Wan 2.1, COLMAP, and splat training. No browser execution is implied.

## GeoLibre handoff

A completed `gaussian_splat` asset should be published as a site-linked layer with:

- `site_id`
- asset identifier
- asset URI
- coordinate reference / geospatial transform metadata
- capture timestamp
- pipeline version
- evidence state
- review status

The first implementation should use downloadable GeoJSON plus an asset registry. A live GeoLibre API adapter should be added only after the target GeoLibre instance and supported layer-ingestion API are verified.
