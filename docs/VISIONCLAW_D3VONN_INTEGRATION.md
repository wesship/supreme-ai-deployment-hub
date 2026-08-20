# VisionClaw × D3VONN.IO Integration Plan

## Decision

Integrate VisionClaw as the smart-glasses client/adapter layer, not as the D3VONN control plane.

VisionClaw currently targets Meta Ray-Ban smart glasses and uses Meta's Wearables Device Access Toolkit (DAT) on iOS/Android. Its current architecture streams glasses video/audio into Gemini Live and can route agent actions to OpenClaw. D3VONN should govern identity, capability, privacy, policy, telemetry, command authorization and audit around that runtime.

## Canonical topology

```text
Ray-Ban Meta / Meta Ray-Ban Display
             |
             | Meta Wearables DAT
             v
        VisionClaw app
             |
             | authenticated D3VONN adapter
             v
       D3VONN Control Plane
             |
       +-----+-----+----------------+
       |           |                |
    Policy      Telemetry         Audit
       |           |                |
       +-----+-----+----------------+
             |
      Edge/AI orchestration
       |        |        |
    Jetson    Hermes   Workflows
```

## Responsibilities

### VisionClaw

- Meta glasses connectivity through supported DAT APIs.
- Camera/audio session handling.
- Device-side user experience.
- Glasses POV/media transport.
- Vendor-specific capability/session details.
- Translation between D3VONN commands and supported device operations.

### D3VONN

- User/service authentication.
- Device enrollment and revocation.
- Capability registry.
- Privacy state and policy.
- Command authorization and expiry.
- Replay/idempotency protection.
- Approval workflow for sensitive/high-impact actions.
- Fleet telemetry and audit.
- Routing to Jetson, Hermes and Automation Studio.
- Model/pipeline governance.

## Display glasses

Meta's Wearables Device Access Toolkit v0.7 added Display capability for Meta Ray-Ban Display glasses. D3VONN therefore treats `display` as a discovered capability rather than assuming it exists on every glasses model.

Display operations should flow through the same policy gateway as camera/audio operations.

## AI provider boundary

VisionClaw's current Gemini Live path should remain an adapter/provider implementation. D3VONN should expose a provider-neutral interface so future routing can include Gemini, OpenAI or local Jetson inference without changing the glasses integration.

```text
VisionClaw media/session
          |
     D3VONN AI gateway
       /    |     \
 Gemini   OpenAI   Jetson/local
       \    |     /
        orchestration
```

## OpenClaw boundary

Do not allow VisionClaw to bypass D3VONN policy by directly granting arbitrary OpenClaw actions. If OpenClaw is retained, actions should be represented as D3VONN tool requests with actor, device, command, approval and audit context.

## Testing stages

1. VisionClaw MockDeviceKit / phone simulation.
2. D3VONN simulated adapter.
3. VisionClaw + D3VONN test gateway.
4. Meta Developer Mode test device.
5. Ray-Ban Meta camera/audio certification.
6. Meta Ray-Ban Display capability certification.
7. Privacy/revocation/expiry tests.
8. Production release-channel certification.

## Release constraints

Meta's DAT is a developer-preview technology and distribution/release-channel constraints may apply. Production deployment must follow Meta's current developer requirements and the exact supported device/API matrix at certification time.

No private or undocumented Meta API is a production dependency.
