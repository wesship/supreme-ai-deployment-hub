# D3VONN Wearable OS Rollout

## Phase 1 — Foundation

- canonical TypeScript wearable contracts
- vendor-neutral adapter registry
- wearable event contract
- Wearable Command Center UI
- policy/audit requirements

## Phase 2 — Meta production adapter

- Meta DAT application configuration
- device discovery and authorization
- camera/audio event bridge
- audio/display response path
- reconnect and permission handling

## Phase 3 — VisionClaw bridge

- VisionClaw ingress normalization
- optional OpenClaw action handoff
- structured events into the coordinator
- end-to-end correlation and audit

## Phase 4 — Edge / Jetson

- device telemetry
- model deployment
- OTA firmware/model workflows
- on-device vision pipeline management
- remote command/control with approvals

## Phase 5 — Multi-vendor

Add adapters without changing the coordinator contract. Candidate classes include display-capable glasses, Android XR devices, and future wearable SDKs.

### XREAL One-family staged gate

- host-bridge adapter and fail-closed event normalization
- `display.hud.render` action contract
- Hermes response-to-HUD path
- optional Needle intent proposal before Hermes dispatch
- physical hardware/host compatibility certification
- reconnect, latency, privacy, power, rollback, and kill-switch tests

See `docs/wearables/XREAL_ONE.md`.

## Production gates

A wearable integration is production-ready only after successful tests for authorization, capture, normalization, response delivery, policy rejection, human approval, disconnect/reconnect, duplicate events, privacy handling, observability, and rollback.
