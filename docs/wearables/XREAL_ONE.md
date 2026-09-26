# XREAL One / One Pro — D3VONN Spatial HUD v1

## Goal

Use XREAL One-family glasses as a display-capable front end for D3VONN Wearable OS while keeping Hermes, policy, memory, tools, and device governance vendor-neutral.

This gate does **not** claim direct hardware control or production certification. It defines the host-bridge contract that a supported phone, computer, or vendor SDK integration can use after physical-device validation.

## Data path

```text
XREAL glasses
  -> supported host device / vendor bridge
  -> xreal-one-host-bridge adapter
  -> canonical WearableEvent
  -> Wearable Gateway
  -> D3VONN Coordinator
  -> Hermes / Needle / agent routing
  -> policy + approval
  -> host render instruction
  -> XREAL display
```

Needle remains the local intent proposal layer. Hermes remains authoritative for orchestration. The XREAL adapter only normalizes host events; it does not bypass GUARDIAN, execute privileged tools, or grant approvals.

## Spatial HUD v1 contract

The first render action uses the existing canonical event type:

```json
{
  "event_type": "wearable.action.requested",
  "payload": {
    "action": "display.hud.render",
    "surface": "primary",
    "text": "Hermes task complete"
  },
  "capabilities": ["display", "commands"]
}
```

Recommended v1 surfaces:

- `primary` — short Hermes answer/status
- `notification` — alerts and approval prompts
- `caption` — live transcription/translation
- `task` — current workflow step/progress
- `context` — object/place/knowledge result returned by perception or RAG

## Security boundary

The bridge must fail closed unless it has:

1. authenticated D3VONN session identity
2. device identity bound to that session
3. explicit consent state
4. correlation and trace identifiers
5. canonical capability list
6. policy evaluation before side effects
7. human approval for consequential actions
8. no privileged credential exposure in the display client

Raw camera/audio media should not be persisted by default. The event ledger should store metadata and derived results unless an approved retention policy explicitly requires raw media.

## Hardware certification gate

Before calling the XREAL path production-ready, verify on the exact supported hardware/host combination:

- connect/disconnect/reconnect
- display initialization
- stable HUD rendering
- text legibility and safe viewport placement
- input/command round trip
- audio path where used
- camera path only where the exact hardware/module supports it
- permission denial and revoked consent
- offline/degraded host behavior
- duplicate/replayed event rejection
- latency measurements
- thermal/power behavior
- rollback/kill switch

## Acceptance sequence

1. Register `xrealOneAdapter` in the integration composition root.
2. Start an authenticated wearable session.
3. Send a signed host event through the wearable ingress.
4. Normalize it to `WearableEvent`.
5. Route a benign command to Hermes.
6. Return a `display.hud.render` action.
7. Render on the host display surface.
8. Persist the audit event.
9. Repeat with policy rejection and approval-required cases.
10. Certify on physical XREAL hardware.

Until those steps pass, XREAL remains a staged adapter, not a production-enabled device.
