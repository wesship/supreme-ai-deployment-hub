# Meta DAT Adapter Specification

## Scope

Implement the Meta Wearables Device Access Toolkit integration behind the D3VONN `WearableAdapter` interface. This document intentionally contains no vendor credentials or secrets.

## Adapter responsibilities

1. Authenticate using the supported Meta application flow.
2. Discover and register compatible devices.
3. Normalize camera, microphone/audio, display, connectivity, and battery signals.
4. Convert vendor callbacks into the canonical D3VONN wearable event envelope.
5. Forward events to `POST /api/v1/vision/events`.
6. Route permitted D3VONN responses back to wearable audio/display capabilities.
7. Preserve consent, privacy, correlation, and audit metadata.

## Security

- Keep credentials in the deployment secret manager; never commit them.
- Request only required device permissions.
- Do not persist raw camera/audio by default.
- Enforce policy before external side effects.
- Support revocation and device disconnect immediately.

## Compatibility strategy

The adapter should advertise capabilities dynamically. Do not assume every Meta device supports display/HUD. Camera/audio-only devices must continue to work.

## Test matrix

- device discovery
- first-time authorization
- reconnect after Bluetooth/network loss
- camera frame normalization
- audio command normalization
- audio response playback
- display response when supported
- duplicate event retry
- revoked permission
- low battery/degraded connection
- policy rejection
- human approval round trip
