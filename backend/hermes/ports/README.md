# Hermes Orchestration Ports

These protocols define the stable boundary between Hermes business logic and infrastructure.

- `TaskRepository` persists tasks, runs, checkpoints, and lifecycle records.
- `AgentDispatcher` sends work to registered execution agents.
- `EventSink` receives structured lifecycle and audit events.
- `Clock` supplies deterministic UTC timestamps.

Production composition uses Supabase REST and the `enqueue-task` Edge Function. Tests and edge deployments can supply alternate implementations through `HermesDependencies` without changing the orchestration engine.
