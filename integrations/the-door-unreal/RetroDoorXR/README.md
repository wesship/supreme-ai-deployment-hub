# RetroDoorXR — UE5 drop-in module

This package is the Unreal client boundary for THE DOOR XR control plane.

## What it does

- Normalizes Meta/OpenXR/XREAL/WebXR/Desktop/Mobile interaction contracts.
- Sends authenticated interaction events to:
  `POST https://api.d3vonn.io/api/the-door/xr/interactions`
- Broadcasts `OnDoorAuthorizationRequired` only when the backend returns:
  - `accepted=true`
  - `authoritative=false`
  - `next_step=authorize_in_game`

## What it never does

- No `OpenLevel` / `LoadLevel`.
- No save mutation.
- No canon/progression mutation.
- No mission completion.
- No direct realm entry.

Bind `OnDoorAuthorizationRequired` to the game's existing authoritative Door
entry function (for example `TryEnterRetroDoor`). That function remains the
only path allowed to transition into a realm.

## Meta hookup

`FMetaDoorXRProvider` intentionally has no compile-time Meta SDK dependency.
Feed it interaction events from the Meta XR Plugin / Interaction SDK available
for the UE version used by the actual game project.

Recommended mappings:

- eye/head ray -> `EDoorXRInputKind::Gaze`
- hand pinch/poke/grab -> `Hand`
- Touch input -> `Controller`
- recognized command -> `Voice`
- persisted room/world anchor -> `SpatialAnchor`

The provider defaults to runtime-not-ready. Mark it ready only after the headset
runtime and required Meta/OpenXR plugins initialize successfully.

## Import

Copy the `RetroDoorXR` directory into the real game's `Plugins/` directory,
regenerate project files, enable the plugin, then compile the target project.
