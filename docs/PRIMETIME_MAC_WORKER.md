# PRIMETIME macOS Worker

## Purpose

`MAC-01` is a specialized Hermes worker for D3VONN/PRIMETIME computer-use workloads. It complements NVIDIA workers rather than replacing the Hermes scheduler or creating a second queue.

## Responsibilities

- Real-browser automation through Browser Harness.
- macOS UI automation through macOS Harness.
- Visual and functional QA of D3VONN web workflows.
- Controlled file and desktop automation.
- Browser evidence capture for staging verification.

## Initial capability contract

Use these capability names in task metadata:

- `macos-control`
- `browser-control`
- `computer-use`
- `visual-qa`
- `desktop-automation`
- `file-automation`

Every Mac worker must also advertise the base `task-dispatch` capability.

## Recommended worker configuration

```text
HERMES_PERSISTENT_WORKERS_ENABLED=true
HERMES_WORKER_ID=PRIMETIME-MAC-01
HERMES_WORKER_REGION=local-mac
HERMES_WORKER_CAPABILITIES=task-dispatch,macos-control,browser-control,computer-use,visual-qa,desktop-automation,file-automation
HERMES_MAX_CONCURRENT_TASKS=1
HERMES_WORKER_HEARTBEAT_TIMEOUT_SECONDS=90
HERMES_WORKER_LEASE_TTL_SECONDS=300
```

Keep `HERMES_MAX_CONCURRENT_TASKS=1` for the first canary. Increase only after resource and UI isolation are verified.

## Security boundary

The Mac worker is an execution node, not the D3VONN control plane.

Do not place Supabase service-role keys, unrestricted production credentials, or long-lived cloud provider credentials on the Mac. The worker should receive only the authorization and task data required for its leased task.

Destructive actions must remain behind an approval policy. Browser content and agent instructions are untrusted input.

## Staging canary

1. Install and pin known-good versions of macOS Harness and Browser Harness on the Mac.
2. Grant only the macOS permissions required by the harness diagnostics.
3. Register `PRIMETIME-MAC-01` with persistent workers enabled in staging only.
4. Submit a disposable task requiring `browser-control` and `visual-qa`.
5. Confirm exactly one active lease and one downstream dispatch.
6. Terminate the worker after lease acquisition and restart it.
7. Confirm lease recovery and no duplicate downstream execution.
8. Run a D3VONN visual smoke test against staging.
9. Confirm worker events and evidence are visible to the Operator Command Center.
10. Keep production disabled until the canary passes and duplicate/orphan monitoring is clean.

## Production promotion gate

Promotion requires:

- stable worker identity;
- successful heartbeat/lease recovery tests;
- pinned dependency versions;
- no production secrets on the Mac;
- approval enforcement for destructive actions;
- audit events for task start, completion, failure, lease loss, and worker drain;
- documented emergency worker revocation.
