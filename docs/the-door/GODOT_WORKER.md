# THE DOOR — Godot Worker Activation

THE DOOR's first real open-source engine transport is the Godot worker bridge.

## Control-plane environment

Configure on the D3VONN backend/Hermes host:

```text
THE_DOOR_GODOT_TRANSPORT_URL=https://godot-worker.example.internal
THE_DOOR_GODOT_TRANSPORT_TOKEN=<shared-random-secret>
THE_DOOR_GODOT_TIMEOUT_SECONDS=30
```

The backend never sends provider credentials to the browser. `/api/the-door/jobs/execute` and `/api/the-door/jobs/verify` remain authenticated D3VONN routes.

## Worker environment

Run `backend.the_door.godot_worker:app` on the host that owns the governed Godot workspace:

```text
THE_DOOR_GODOT_WORKSPACE_ROOT=/srv/d3vonn/godot-projects
THE_DOOR_GODOT_BIN=/usr/local/bin/godot
THE_DOOR_GODOT_WORKER_TOKEN=<same-shared-random-secret>
THE_DOOR_GODOT_COMMAND_TIMEOUT_SECONDS=120
THE_DOOR_GODOT_MAX_LOG_CHARS=12000
```

Process entrypoint:

```text
uvicorn backend.the_door.godot_worker:app --host 0.0.0.0 --port 8765
```

Use TLS or a private authenticated network in front of the worker. The transport client does not follow redirects.

## Worker contract

- `GET /health`
- `POST /v1/jobs/execute`
- `POST /v1/jobs/verify`

Mutation requests require `Authorization: Bearer <THE_DOOR_GODOT_WORKER_TOKEN>`.

## Supported v0.1 jobs

`create_or_open_project` validates a workspace-relative `project_path` and requires `project.godot`.

`run_playtest` runs a fixed headless Godot command. Inputs are `project_path`, optional `scene`, and bounded `quit_after`. Arbitrary CLI arrays and shell strings are not accepted.

`package_build` requires `project_path`, `export_preset`, and a project-confined `output_path`. Success requires a zero exit code and a real output artifact.

## Verification

Verification checks `project.godot`, successful playtest exit status, or a packaged artifact inside the governed project directory. It does not trust arbitrary filesystem paths returned by callers.

## Current boundary

`create_level`, `create_actor`, `configure_component`, `author_gameplay_logic`, `capture_observation`, `diagnose_failure`, and `apply_repair` remain blocked until a typed Godot editor plugin/RPC protocol is implemented. That future protocol should not accept arbitrary GDScript or shell commands from Hermes.
