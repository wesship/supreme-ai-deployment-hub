# THE DOOR — Meta XR Integration

Meta XR is integrated as an input/presentation adapter, not as an authoritative
gameplay runtime.

## Runtime path

```text
Meta headset / glasses
        |
        v
Meta XR / OpenXR input
        |
        v
Unreal Door XR component
        |
        v
POST /api/the-door/xr/interactions
        |
        v
THE DOOR authorization/gameplay gate
        |
        +--> denied: remain in current state
        |
        +--> allowed: Unreal performs the governed portal transition
```

## Invariants

1. Meta input never changes save, canon, progression, mission state, or realm state directly.
2. Meta input never calls OpenLevel/LoadLevel as an authorization shortcut.
3. XR is provider-neutral. Meta is the first concrete adapter; OpenXR, XREAL,
   WebXR, desktop, and mobile remain valid provider boundaries.
4. Unreal remains authoritative for the game runtime and must call the existing
   Door-entry gameplay gate before a portal transition.
5. The backend stores no Meta platform secret for this interaction boundary.

## Unreal handoff

The Unreal client should translate gaze, hands/controllers, voice intents, and
spatial-anchor interaction into the `d3vonn.the-door.xr-interaction/v1`
contract. A successful backend normalization returns
`next_step=authorize_in_game`; that is not permission to enter a realm by
itself. The Unreal gameplay layer must still perform its normal Door-entry
authorization check.

Recommended Unreal module boundary:

```text
IDoorXRProvider
  |- FMetaDoorXRProvider
  |- FOpenXRDoorProvider
  |- FXrealDoorXRProvider

UDoorXRSubsystem
  |- NormalizeInput()
  |- RequestInteraction()
  |- RequestDoorAuthorization()
```
