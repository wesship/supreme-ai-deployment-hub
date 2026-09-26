# AquaGov 3D Asset Registry

## Goal

Provide a stable research asset contract between field capture, local GPU reconstruction, QA, and GeoLibre.

## Asset lifecycle

`draft → queued → running → review → complete`

Terminal failure state: `failed`.

## Evidence provenance

`observed | reconstructed | inferred | verified`

A source photograph can be observed while a generated reconstruction remains reconstructed. Provenance must be preserved per asset and never upgraded automatically.

## Asset record

```json
{
  "asset_id": "asset-uuid",
  "site_id": "SHO-001",
  "kind": "gaussian-splat",
  "status": "review",
  "evidence_state": "reconstructed",
  "source": { "kind": "panorama", "uri": "local://captures/SHO-001/pano.jpg", "sha256": "..." },
  "pipeline": { "matrix3d": "version-or-commit", "wan21": "version-or-commit", "colmap": "version", "splat_trainer": "version" },
  "outputs": { "colmap_uri": "local://assets/SHO-001/colmap/", "splat_uri": "local://assets/SHO-001/scene.splat" },
  "qa": { "reviewed": false, "reviewer": null, "notes": null }
}
```

## Job contract

The web application submits a job description; the GPU worker performs compute.

```json
{
  "job_id": "job-uuid",
  "site_id": "SHO-001",
  "asset_id": "asset-uuid",
  "input_uri": "local://captures/SHO-001/pano.jpg",
  "requested_outputs": ["synthetic-flythrough", "colmap", "gaussian-splat"],
  "status": "queued"
}
```

The worker may update `queued`, `running`, `failed`, `review`, and `complete`. It must not change evidence provenance from reconstructed/inferred to verified.

## Required metadata

- stable `site_id`
- stable `asset_id`
- capture source URI
- cryptographic source hash when available
- capture timestamp when available
- pipeline component versions/commits
- output URIs
- QA state
- evidence state

## GeoLibre handoff

When an asset reaches `complete`, AquaGov can publish a reference to the asset alongside the site layer. The Gaussian Splat remains a 3D asset; the governance GeoJSON remains the authoritative field-data layer.

## Acceptance criteria

1. Every 3D asset maps to exactly one stable site identifier.
2. Original source remains traceable.
3. Pipeline versions are recorded.
4. Failed jobs do not create `complete` assets.
5. QA is explicit.
6. Provenance cannot silently become `verified`.
7. GeoLibre publication can reference the asset without copying governance data into the 3D artifact.
