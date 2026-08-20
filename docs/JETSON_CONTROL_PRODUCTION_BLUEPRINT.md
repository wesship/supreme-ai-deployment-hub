# Jetson Control — Production Blueprint

## Purpose

Jetson Control is the D3VONN.IO edge-AI control plane for Jetson smart-glasses clusters and on-device robotics. It must reuse the existing D3VONN deployment architecture rather than introducing a parallel application.

Current target topology:

`Vercel UI → authenticated backend on Railway → Supabase state/audit → authenticated Jetson device adapter`

The browser is never a device-control transport.

## Safety boundary

All device actions follow:

`Identity → Authorization → Command validation → Safety policy → Device adapter → Result → Immutable audit`

A command is rejected when any mandatory gate fails.

### Device identity

- Unique device identity and enrollment record.
- Cryptographic device credentials managed outside the browser.
- Explicit revoked and quarantined states.
- Heartbeat/telemetry establishes liveness but does not grant command authority.

### Command plane

Every command carries:

- `command_id`
- `request_id`
- `device_id`
- `actor_id`
- command kind
- issued/expiry timestamps
- bounded payload

Commands require authorization and expiration checks. High-impact operations require an additional policy/approval decision.

### Replay protection

The production adapter must reject a command ID or request ID that has already been consumed. The persistence layer should retain a short-lived idempotency record for command execution and a durable audit event for the result.

### OTA model and firmware

Production deployment requires:

1. Signed artifact.
2. Immutable artifact digest.
3. Device compatibility gate.
4. Canary/staged rollout.
5. Health verification.
6. Automatic rollback on failed health criteria.
7. Durable deployment/audit record.

Unsigned or unverifiable artifacts must never be executable by the device adapter.

### Vision pipeline

A pipeline definition should identify:

- input source
- preprocessing
- model artifact/version
- inference runtime
- postprocessing
- output target
- resource budget
- health criteria

The pipeline composer produces a versioned deployment specification; it does not directly execute code on a device.

### Safety

The control plane must support a safe-state operation and a device-side fail-safe state. Loss of network connectivity must not leave an actuator waiting indefinitely for a remote command.

For robotics, any command capable of changing physical motion must additionally pass the project's robotics safety policy and bounded-command checks.

## Canonical end-to-end verification

A release is not production-ready until the following scenario passes in a non-production device environment:

1. Enroll a test Jetson.
2. Verify telemetry heartbeat and device identity.
3. Issue an authorized health command.
4. Verify the device executes it and returns a result.
5. Verify the command and result appear in the audit trail.
6. Attempt the same command with an unauthorized actor and verify denial.
7. Attempt an expired command and verify denial.
8. Revoke the device and verify command denial.
9. Submit a signed model deployment to a canary device.
10. Force a failed health check and verify automatic rollback.
11. Trigger safe-state behavior and verify the device reaches the expected safe state.
12. Verify every transition is attributable to a request, actor/device identity and timestamp.

## Implementation status

### Implemented in this increment

- Replaced the roadmap-only Jetson page with a safety-first readiness/control-plane surface.
- Added transport-neutral telemetry and command contracts under `backend/jetson_control/`.
- Added deny-by-default domain safety gates.
- Added unit-level safety test vectors for revoked devices, expiry, authorization, standard commands and high-impact commands.
- Documented the production topology and end-to-end verification contract.

### Still requires live infrastructure integration

- Supabase persistence/migrations for devices, telemetry, command idempotency and audit events.
- Authenticated Railway API routes and device adapter.
- Device certificate enrollment/revocation service.
- Signed OTA artifact registry and rollout worker.
- Jetson-side agent implementing the device protocol.
- Live telemetry transport and fleet monitoring.
- Hardware-in-the-loop verification for robotics safety.

These are deliberately not faked by the UI. The readiness surface remains command-locked until the backend/device boundary exists.
