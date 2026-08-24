# D3VONN PRIMETIME Mac Worker Architecture

```text
D3VONN.IO / OCC
      |
PRIMETIME agent layer
      |
Hermes scheduler + persistent worker registry
      |
  +---+-------------------+
  |                       |
NVIDIA workers         MAC-01
AI/video/vision        macOS/browser/computer-use
                          |
                  macOS Harness + Browser Harness
```

The Mac is a specialized execution worker. Hermes remains the only task scheduler and lease authority.

## Routing

Task metadata may request `required_capabilities`. Hermes should acquire a lease only when the worker advertises all requested capabilities plus `task-dispatch`.

Example:

```json
{
  "required_capabilities": ["browser-control", "visual-qa"]
}
```

Capability requests are routing metadata, not a privilege grant. Authorization and approval policy must be evaluated separately before executing sensitive operations.

## Isolation

- One concurrent task per Mac during the initial canary.
- Per-task working directory.
- No shared browser profile for unrelated tenants.
- No persistent production credentials in the worker environment.
- Short-lived task credentials only.
- Immediate drain/revoke on worker health or integrity failure.

## OCC observability

Expose worker registry state and task events in the existing Operator Command Center. Do not create a second worker database or shadow scheduler.

Recommended events:

- `hermes.worker.started`
- `hermes.worker.heartbeat_failed`
- `hermes.worker.lease_acquired`
- `hermes.worker.lease_release_failed`
- `hermes.worker.task_completed`
- `hermes.worker.task_failed`
- `hermes.worker.draining`
- `hermes.worker.stopped`

## Rollback

Disable persistent worker mode for `MAC-01`, drain it, verify no active leases remain, then remove the Mac worker process. Existing Hermes tasks remain recoverable through the durable task/lease model.
