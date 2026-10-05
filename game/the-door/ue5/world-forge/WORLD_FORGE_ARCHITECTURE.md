# D3VONN.IO World Forge — The Door

## Purpose

Combine **God's Eye View** and **GeoLibre** into a world-location pipeline for *The Door* without making either external project authoritative over gameplay or saves.

## Source projects

- God's Eye View upstream: `bilawalsidhu/gods-eye-view`
- GeoLibre upstream: `opengeos/GeoLibre`

Both are treated as upstream geospatial/UI inspiration and tooling sources. Third-party data, imagery, basemaps, camera feeds, and provider APIs retain their own licenses/terms.

## Runtime ownership

```text
GodEye selection/discovery
        ↓
FDoorLocationDefinition
        ↓
GeoLibre preprocessing / world-source manifest
        ↓
FDoorWorldDefinition
        ↓
Unreal Engine world/level
        ↓
Door / campaign / save authority
```

Unreal Engine remains authoritative for Door progression, gameplay, collision, AI, combat, save/load, streaming, packaging, and offline behavior.

## World classes

- Real Earth
- Historical Earth
- Alternate Earth
- Planetary
- Door Realm / anomaly

## Initial seeded locations

Earth:
- New York City
- Philadelphia
- Denver
- Accra, Ghana
- Dubai, UAE

Planetary:
- Moon / Tranquility region
- Mars / Valles Marineris
- Europa

Door Realm:
- `WORLD_DOOR_REALM_001`

## Gate rule

This feature remains `SCAFFOLDED` until its C++ overlay compiles in UE 5.3 and a playable Door can select one seeded location, resolve a world definition, open the corresponding map, save, quit, and cold-reload successfully.
