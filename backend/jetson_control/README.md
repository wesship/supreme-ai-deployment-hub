# Jetson Control Gateway

## Production boundary

`gateway.py` is the final backend safety boundary before a device adapter. It must be called only after authentication and authorization have established the actor context.

The expected production sequence is:

1. Authenticate operator/service.
2. Resolve device from the server-side registry.
3. Resolve capabilities and current privacy/device state.
4. Create and persist the command with a unique `command_id` and `request_id`.
5. Evaluate command safety and any required approval.
6. Dispatch through the authenticated vendor/companion/Jetson adapter.
7. Persist result and audit event.
8. Update telemetry/device state.

## Smart glasses

The first-class smart-glasses model supports Ray-Ban Meta / Meta device families through an approved vendor or companion adapter. It does not assume undocumented direct control of the glasses.

The `SimulatedDeviceAdapter` exists solely for deterministic tests and cannot reach physical hardware.

## Production requirements before enabling hardware

- authenticated adapter transport
- device credential rotation and revocation
- command idempotency/replay protection in persistence
- signed OTA artifact verification
- user-visible vendor permissions for sensor access
- privacy-lock enforcement
- durable audit events
- hardware-in-the-loop verification
