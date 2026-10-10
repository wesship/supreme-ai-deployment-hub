# AquaGov ↔ GeoLibre Integration Contract

## Purpose

AquaGov owns field/governance records and exports GeoJSON. GeoLibre is the spatial workspace. This integration deliberately uses GeoLibre's documented project/layer format instead of inventing an undocumented API.

## Verified GeoLibre capabilities

GeoLibre projects are saved as `.geolibre.json` and support a `layers` array with GeoJSON-backed vector layers, styles, metadata, and capabilities. GeoLibre's documented Add Data flow also supports GeoJSON vector layers and Gaussian Splatting as a 3D layer type.

## AquaGov layer contract

```json
{
  "id": "aquagov-sites",
  "name": "AquaGov Field Sites",
  "type": "geojson",
  "source": { "type": "geojson" },
  "visible": true,
  "opacity": 1,
  "geojson": { "type": "FeatureCollection", "features": [] },
  "metadata": {
    "owner": "AquaGov",
    "schemaVersion": "1.0",
    "evidenceState": "field-record"
  },
  "capabilities": {
    "query": true,
    "create": false,
    "update": false,
    "delete": false,
    "export": true
  }
}
```

## Evidence rules

- `field-record`: observed coordinates/attributes imported from field records.
- `reconstructed`: generated 3D content derived from captured imagery.
- `inferred`: analytical/model-derived content.
- `verified`: researcher-reviewed evidence.

A Gaussian Splat must never be labeled `observed` solely because its source photograph was observed. Generated geometry remains reconstructed until independently verified.

## GeoLibre handoff

1. Export `aquagov-sites.geojson` from AquaGov.
2. Open GeoLibre.
3. Add Data → Vector Layer and load the GeoJSON.
4. Save the project as `.geolibre.json` when a persistent project is desired.
5. Add Gaussian Splatting through GeoLibre's documented 3D layer flow when a verified splat asset is available.

## Future automation

A future adapter may generate or update a `.geolibre.json` project artifact. It should not assume a server-side GeoLibre API unless the target deployment exposes and documents one.

## Acceptance criteria

- GeoJSON imports without transformation.
- Coordinates remain EPSG:4326.
- Site IDs remain stable across exports.
- Governance attributes remain properties on the corresponding feature.
- Evidence state is preserved.
- 3D assets are linked by stable `site_id`/`asset_id`, not embedded as fake geometry.
