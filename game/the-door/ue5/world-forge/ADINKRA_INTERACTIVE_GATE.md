# Adinkra Interactive Encounter Gate

Status: SCAFFOLDED. This gate is not VERIFIED or CERTIFIED until UE 5.3 compile/runtime evidence exists.

## Goal

Make Adinkra symbols interactable story objects throughout The Door while preserving their Ghanaian/Akan cultural meaning separately from fictional Door-system uses.

## First encounter: Sankofa

The first intended placement is in the Accra/Ghana world context. `AAdinkraEncounterActor` defaults to `ADINKRA_SANKOFA` and exposes Blueprint-callable `CanInteract` and `Interact` methods.

Interaction flow:

1. Player approaches the symbol.
2. Game supplies current Gnosis.
3. Actor resolves the symbol through `UAdinkraSymbolSubsystem`.
4. Gnosis gating is evaluated.
5. Interaction records discovery and the authoritative WorldID through the subsystem.
6. Blueprint/UI can react to `OnEncounterResolved` for presentation, audio, codex, Door response, or narrative branching.

## Cultural rule

The cultural meaning stored in `FAdinkraSymbolDefinition::CulturalMeaning` is authoritative descriptive context for the symbol. Fictional gameplay roles and appearances in non-Ghana worlds are Door-system echoes and must not be presented as historical claims that Adinkra symbols existed at those locations.

## World use

The same actor class can be placed on:

- Door surfaces and thresholds
- walls and architectural fragments
- artifacts and memory objects
- GodEye nodes
- World Forge anomaly markers
- puzzle anchors

## Runtime authority

Adinkra actors do not own campaign progression or persistence. They emit interaction/discovery state into the symbol subsystem; campaign/save systems remain authoritative for durable progression.

## Required evidence

- UE 5.3 UHT/C++ compile
- actor can be placed in a map
- Sankofa resolves successfully at Gnosis 0
- discovery records the active WorldID
- repeated interaction increments encounter state without corrupting identity
- locked symbols fail closed below required Gnosis
- save/reload continuity is demonstrated once Adinkra serialization is wired
