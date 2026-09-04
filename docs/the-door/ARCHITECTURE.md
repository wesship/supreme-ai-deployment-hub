# THE DOOR — Game Development Runtime

THE DOOR is the D3VONN.IO game-development subsystem. It is a sibling to AI Films, not a submodule of AI Films.

## Mission

Turn D3VONN canon, characters, worlds, assets, and agent intelligence into playable experiences across multiple engines while keeping engine vendors, editor agents, asset tools, and runtimes replaceable.

## Runtime boundary

```text
Hermes
  -> THE DOOR Director
      -> Game Project Graph
      -> Canon + Asset Bridge
      -> Shared Creative Pipeline
          -> Blender Asset Pipeline
              -> model / rig / animate / LOD / collision / bake
              -> glTF / USD derived assets
              -> AI Films + THE DOOR consumers
      -> Engine Control Plane
          -> Unreal -> Aura Adapter
          -> Unreal -> Native Adapter (future)
          -> Godot Adapter
          -> O3DE Adapter
          -> Bevy Adapter
          -> Stride Adapter
          -> GDevelop Adapter
      -> Verification Loop
          -> Build
          -> Execute / Playtest
          -> Observe
          -> Diagnose
          -> Repair
          -> Retest
          -> Verify
      -> Hermes Gate
```

## Engine strategy

THE DOOR is not an Unreal-only product. Engine choice is project policy.

- **Unreal + Aura** — high-end commercial production and editor-agent automation.
- **Godot** — primary open-source general-purpose engine for autonomous scene/game generation and rapid iteration.
- **O3DE** — high-fidelity worlds, simulation, robotics, and digital-twin workloads.
- **Bevy** — Rust/ECS simulation path for large NPC populations, procedural systems, and agent-heavy worlds.
- **Stride** — C#/.NET game and VR workflows.
- **GDevelop** — fast low-code prototypes and web/mobile builds.

Every engine integrates through the same internal adapter boundary. An adapter must report `configured=false` and block mutation jobs until a real transport exists.

## Shared Blender pipeline

Blender is a DCC/asset pipeline, not a game engine. It sits above engine adapters so a canonical D3VONN character, prop, environment, or animation can serve both AI Films and THE DOOR without duplicating source truth.

Recommended production line: **Blender 5.2 LTS**.

The pipeline boundary covers modeling, rigging, animation, retargeting, LOD generation, collision generation, texture baking, Geometry Nodes, glTF export, and USD export. Canonical source assets remain immutable; engine-specific variants are derived artifacts.

## First-class responsibilities

- Game design / GDD orchestration
- Narrative, quest, mission, and dialogue systems
- World and level construction
- Character / NPC runtime coordination
- Gameplay systems and interaction logic
- Multi-engine project operations
- Automated playtesting and QA
- Build verification and release readiness
- Shared canon and asset consumption from D3VONN knowledge services

## Non-responsibilities

THE DOOR does not own film rendering, mastering, shot assembly, or AI Films provider orchestration. AI Films and THE DOOR share canon, source assets, voice, animation, image, video, and world data through governed contracts.

## Security and truthfulness boundary

Runtime mutation endpoints require authenticated users. Adapter discovery may be public, but no engine or Blender operation may claim success without a configured transport and observable verification evidence.

## Hermes contract

Hermes owns orchestration, goals, retries, checkpoints, interrupts, approvals, provider selection, and final verification gates. THE DOOR emits structured execution and verification results back to Hermes.

## v0.1 gate

THE DOOR v0.1 is complete when the repository has:

1. Multi-engine domain models and provider contracts.
2. Provider-neutral engine adapters with Aura, Godot, O3DE, Bevy, Stride, and GDevelop boundaries.
3. A shared Blender asset-pipeline boundary.
4. A `/api/the-door/*` backend surface with authenticated mutations.
5. A `/the-door` authenticated UI surface.
6. Canon / asset references that do not duplicate AI Films data.
7. A build -> playtest -> observe -> repair -> verify state machine.
8. Unit and route tests for the new boundary.
9. Real editor/worker transports activated separately only after configuration and verification.

## Naming lock

**THE DOOR = D3VONN.IO Game Development.**
