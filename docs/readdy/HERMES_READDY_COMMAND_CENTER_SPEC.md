# D3VONN.IO Hermes Readdy Command Center Spec

## Purpose
Design Hermes as the orchestration brain of D3VONN.IO without changing the existing runtime contracts.

## Core positioning
Eyebrow: D3VONN.IO HERMES
Headline: Orchestrate intelligence into action.
Supporting copy: Coordinate tasks, agents, research, AI Films, workflows, knowledge, and distributed workers from one governed command layer.

## Primary surfaces
1. Hermes Command Center
2. Task Engine
3. Agent Dispatch
4. Worker Mesh
5. Research OS
6. AI Films orchestration
7. Checkpoints and recovery
8. Runtime health
9. DKOS / Knowledge connectivity
10. Audit and operator controls

## Hero status strip
- Task engine
- Persistent workers
- Worker leases
- Checkpoint recovery
- Research routing
- AI Films DAG
- Operator protected

## Command metrics
- Active tasks
- Queued tasks
- Running workers
- Available capacity
- Active leases
- Recoverable checkpoints
- Failed tasks
- Research jobs

Display em dash or Preview when live telemetry is unavailable. Do not invent production statistics.

## Task engine workspace
Table columns:
- Task
- Type
- Assigned agent
- Priority
- Status
- Source
- Scheduled
- Deadline
- Correlation ID
- Updated

Actions:
- Inspect
- Dispatch
- Pause
- Cancel
- Retry
- Open checkpoint

Respect actual runtime states from the backend. Do not create fake state transitions.

## Agent dispatch
Create a dispatcher panel showing the D3VONN agent hierarchy and task-to-agent assignment.
Display:
- Agent name
- Capabilities
- Availability
- Current load
- Recent success/failure state
- Required permissions

Actions must map to backend-governed dispatch rather than direct browser authority.

## Worker Mesh
Visualize distributed Hermes workers as an SVG mesh.
Each worker shows:
- Worker ID
- Capability set
- Capacity
- Health
- Heartbeat
- Active lease
- Lease deadline
- Version

Use animated paths only to represent known or demo connectivity. Label demo state clearly.

## Lease and recovery panel
Show:
- Active leases
- Expiring leases
- Recovered leases
- Worker heartbeat gaps
- Checkpoint availability
- Restart-safe workflow state

## Checkpoint timeline
Create a visual checkpoint history for long-running workflows.
States:
- Saved
- Restored
- Superseded
- Failed

Actions:
- Inspect snapshot
- Compare
- Resume from checkpoint
- View execution lineage

Do not expose unsafe resume controls unless backend authorization exists.

## Research OS
Expose the six current research roles:
- Research Router
- Parallel Collector
- Evidence Ranker
- Lead Enrichment
- Grok Trend Router
- DKOS Memory Writer

Research view includes:
- Query
- Sources
- Collection status
- Evidence scores
- Lead candidates
- DKOS write status
- Source health

## AI Films orchestration
Create an AI Films DAG monitor:
- Project
- Shot
- DAG node
- Assigned task
- Worker
- Status
- Dependency
- Output

Show task-event advancement when Hermes tasks complete, fail, or cancel.

## Knowledge / DKOS relationship
Visualize:
User objective -> Hermes -> Research / Agents / Workflows -> DKOS -> Knowledge Graph -> Memory + RAG -> next action

Provide links to:
- DKOS ingestion
- Knowledge Graph
- RAG
- Research OS

## Runtime health
Panels:
- API health
- Supabase connectivity
- Worker health
- Dispatch health
- Lease integrity
- Checkpoint persistence
- Research adapters
- AI Films bridge

Never show a subsystem as healthy unless real telemetry supports it.

## Operator trust and security
Hermes is operator protected. UI should expose:
- Authenticated operator state
- Audit events
- Task mutation history
- Dispatch history
- Permission boundaries
- Runtime version
- Upstream candidate version

Do not imply the optional upstream Nous Hermes runtime is production-active unless target-host evidence proves it.

## Upstream Hermes panel
Show a separate clearly labeled card:
Optional upstream Hermes Agent runtime
- Current pinned release: v0.20.6
- Trusted tag: v2026.8.27
- Immutable commit verification
- Lock-enforced install
- Status values: Not staged / Staged candidate / Promoted

Do not equate GitHub gate success with live production activation.

## Navigation
- Command Center
- Hermes
- Agents
- Workflows
- Research OS
- AI Films
- DKOS
- Knowledge Graph
- Trust & Security

## Reusable components
- HermesHero
- HermesCommandMetrics
- HermesTaskTable
- HermesTaskInspector
- HermesAgentDispatcher
- HermesWorkerMesh
- HermesLeasePanel
- HermesCheckpointTimeline
- HermesResearchPanel
- HermesFilmDAGMonitor
- HermesKnowledgeFlow
- HermesRuntimeHealth
- HermesAuditPanel
- HermesUpstreamRuntimeCard

## Visual direction
Use the D3VONN Sovereign Signal system:
- deep black / graphite / titanium
- bright white type
- electric cyan / signal blue
- restrained violet
- green healthy
- amber degraded
- red blocked/failure

Hermes should feel like a mission-control orchestration system, not a chat page.

## Technical handoff
Readdy is the frontend design/prototyping layer only.
Preserve D3VONN backend contracts, especially:
- /api/hermes/tasks/*
- operator access enforcement
- task state machine
- agent dispatch
- persistent worker leases
- checkpoint recovery
- Research OS routes
- AI Films task-event bridge

Approved UI integrates back into wesship/supreme-ai-deployment-hub.
Do not replace the Hermes backend, Supabase persistence, worker runtime, or release gates with Readdy-only logic.
