# SYSTEM_AUTHORITY.md

## Purpose

This document defines authority boundaries for DEVONN.AI across strategy, governance, execution, validation, and shipping.

## Authority Principle

No system component may approve its own work for production.

Decision, execution, validation, and approval must remain separated.

## Authority Layers

### Human Operator

Final authority for:
- production approval
- destructive actions
- billing changes
- secret rotation
- database deletion
- private beta approval

### CLAUDE.md

Project operating charter.

Defines:
- stack overview
- gate discipline
- agent roster
- sprint guidance
- project rules

### AUTH.md

Authentication and authorization authority.

Defines:
- roles
- permissions
- HITL rules
- secrets policy

### GATES.md

Gate evidence authority.

Defines:
- required gates
- proof requirements
- gate states
- shipping rules

### AGENTS.md

Agent role authority.

Defines:
- agent responsibilities
- command scope
- escalation paths

## System Planes

### Control Plane

Repository:
`wesship/supreme-ai-deployment-hub`

Authority:
- dashboard
- command routing
- gate visibility
- product surface
- release coordination

### Runtime Plane

Repository:
`devonn-codeops-agent-mesh`

Authority:
- runtime workers
- code execution
- dispatch consumers
- backend task execution

### Orchestration Plane

Repository:
`MyClaw`

Authority:
- OpenClaw agent coordination
- War Room operations
- multi-agent task routing

### Governance Plane

System:
Hermes

Authority:
- memory
- approvals
- context retrieval
- HITL governance

Hermes is not production execution authority.

## OpenClaw Authority Map

claw-01: Strategic authority
claw-02: Engineering authority
claw-03: Design authority
claw-04: QA and validation authority
claw-05: Security authority

## Shipping Authority

Shipping requires:
- all required gates GREEN with proof
- no unresolved security blocker
- release notes prepared
- rollback path known
- operator approval for destructive actions

## Prohibited Authority Crossovers

- Builder may not mark QA green.
- QA may not override Security.
- Security may not deploy production.
- Hermes may not execute destructive operations.
- Ship may not proceed without gate evidence.

## Private Beta Authority

Private beta remains blocked until:
- DNS gate is GREEN
- Health gate is GREEN
- core production flow is verified
