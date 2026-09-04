# THE DOOR — Game Development Runtime

THE DOOR is the D3VONN.IO game-development subsystem. It is a sibling to AI Films, not a submodule of AI Films.

## Mission

Turn D3VONN canon, characters, worlds, assets, and agent intelligence into playable Unreal Engine experiences while keeping engine vendors and agent runtimes replaceable.

## Runtime boundary

```text
Hermes
  -> THE DOOR Director
      -> Game Project Graph
      -> Canon + Asset Bridge
      -> Engine Adapter
          -> Aura Adapter (initial)
          -> Native Unreal Adapter (future)
      -> Verification Loop
          -> Build
          -> Execute / Playtest
          -> Observe
          -> Diagnose
          -> Repair
          -> Retest
      -> Hermes Gate
```

## First-class responsibilities

- Game design / GDD orchestration
- Narrative, quest, mission, and dialogue systems
- World and level construction
- Character / NPC runtime coordination
- Gameplay systems and interaction logic
- Unreal Engine project operations
- Automated playtesting and QA
- Build verification and release readiness
- Shared canon and asset consumption from D3VONN knowledge services

## Non-responsibilities

THE DOOR does not own film rendering, mastering, shot assembly, or AI Films provider orchestration. AI Films and THE DOOR may share canon, assets, voice, image, video, and world data through contracts.

## Provider strategy

Aura is an adapter, not the control plane. THE DOOR must remain usable if Aura is replaced. All engine-agent operations flow through an internal adapter contract.

Initial adapter capabilities:

- create_or_open_project
- create_level
- create_actor
- configure_component
- author_gameplay_logic
- run_playtest
- capture_observation
- diagnose_failure
- apply_repair
- verify_result
- package_build

## Hermes contract

Hermes owns orchestration, goals, retries, checkpoints, interrupts, and approvals. THE DOOR emits structured execution events and verification results back to Hermes.

## v0.1 gate

THE DOOR v0.1 is complete when the repository has:

1. A domain model for game projects and engine jobs.
2. An engine-adapter interface with an Aura implementation boundary.
3. A `/api/the-door/*` backend surface.
4. A `/the-door` authenticated UI surface.
5. Canon / asset references that do not duplicate AI Films data.
6. A build -> playtest -> observe -> repair -> verify state machine.
7. Unit and route tests for the new boundary.

## Naming lock

**THE DOOR = D3VONN.IO Game Development.**
