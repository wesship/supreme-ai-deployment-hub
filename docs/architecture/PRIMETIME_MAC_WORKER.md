# PRIMETIME macOS Worker

`PRIMETIME-MAC-01` is a specialized Hermes execution worker for controlled
browser, visual-QA, computer-use, and macOS automation. Hermes remains the sole
queue and lease authority; the Mac does not become a second control plane.

Task producers declare routing requirements in
`input_data.required_capabilities`. The database-atomic claim function reads the
worker's registered capabilities and leases only tasks whose requirements are a
subset. Capability metadata routes work—it never authorizes an action. Existing
server-side safety, approval, and compliance checks remain mandatory.

Initial staging configuration:

```text
HERMES_PERSISTENT_WORKERS_ENABLED=true
HERMES_WORKER_ID=PRIMETIME-MAC-01
HERMES_WORKER_REGION=local-mac
HERMES_WORKER_CAPABILITIES=task-dispatch,macos-control,browser-control,computer-use,visual-qa,desktop-automation,file-automation
HERMES_MAX_CONCURRENT_TASKS=1
HERMES_WORKER_HEARTBEAT_TIMEOUT_SECONDS=90
HERMES_WORKER_LEASE_TTL_SECONDS=300
```

The physical Mac must use a dedicated OS account, per-task working directories,
separate browser profiles, pinned harness versions, and only short-lived scoped
credentials. Do not install Supabase service-role, unrestricted production, or
long-lived cloud-provider credentials on it.

Production activation is not part of this gate. A later canary must prove one
lease and one dispatch, restart recovery without duplication, evidence capture,
worker drain/revocation, and clean orphan monitoring before promotion.
